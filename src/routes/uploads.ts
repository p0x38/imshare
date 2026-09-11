import type { FastifyPluginAsync } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";
import { loadConfig } from "../lib/config.js";
import { broadcastUploadStatus } from "../lib/realtime.js";
import { generateThumbHash, queueThumbnailGeneration } from "../lib/thumbnails.js";

const IMAGE_TYPES = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".gif", "image/gif"],
    [".webp", "image/webp"],
    [".bmp", "image/bmp"],
    [".avif", "image/avif"],
]);
function hasImageSignature(buffer: Buffer, extension: string): boolean {
    switch (extension) {
        case ".jpg":
        case ".jpeg":
            return (
                buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
            );
        case ".png":
            return buffer
                .subarray(0, 8)
                .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        case ".gif":
            return (
                buffer.subarray(0, 6).equals(Buffer.from("GIF87a")) ||
                buffer.subarray(0, 6).equals(Buffer.from("GIF89a"))
            );
        case ".webp":
            return (
                buffer.length >= 12 &&
                buffer.subarray(0, 4).toString() === "RIFF" &&
                buffer.subarray(8, 12).toString() === "WEBP"
            );
        case ".bmp":
            return buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d;
        case ".avif":
            return (
                buffer.length >= 12 &&
                buffer.subarray(4, 8).toString() === "ftyp" &&
                (buffer.subarray(8).toString().includes("avif") ||
                    buffer.subarray(8).toString().includes("avis"))
            );
        default:
            return false;
    }
}
function uploadView(upload: any) {
    return { ...upload, url: `/v1/posts/image/${encodeURIComponent(upload.id)}` };
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const uploadDir = path.resolve(process.cwd(), config.storage.uploadDirectory);
    const cacheDir = path.join(uploadDir, ".cache");
    await mkdir(uploadDir, { recursive: true });
    fastify.post("/v1/uploads", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const multiple = (request.query as Record<string, unknown>).multiple === "true";
        const parts = request.parts({
            limits: { files: multiple ? 20 : 1, fileSize: config.storage.maxFileSize, fields: 4 },
        });
        const uploads: any[] = [];
        try {
            for await (const part of parts) {
                if (part.type !== "file") continue;
                const uploadId = randomUUID();
                const ext = path.extname(part.filename).toLowerCase();
                const mime = IMAGE_TYPES.get(ext);
                if (!mime || part.mimetype !== mime) {
                    part.file.resume();
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: "Unsupported image type.",
                    });
                    return reply
                        .code(400)
                        .send({
                            error: { code: "INVALID_FILE", message: "Unsupported image type." },
                        });
                }
                broadcastUploadStatus(user.id, { uploadId, status: "uploading", progress: 0 });
                const temporaryPath = path.join(uploadDir, `.upload-${uploadId}${ext}`);
                try {
                    await pipeline(part.file, createWriteStream(temporaryPath, { flags: "wx" }));
                } catch (error) {
                    await unlink(temporaryPath).catch(() => undefined);
                    const cancelled =
                        (error as NodeJS.ErrnoException).name === "AbortError" ||
                        request.raw.destroyed;
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: cancelled ? "cancelled" : "failed",
                        error: cancelled ? undefined : "Upload failed.",
                    });
                    if (cancelled)
                        return reply
                            .code(499)
                            .send({
                                error: { code: "UPLOAD_CANCELLED", message: "Upload cancelled." },
                            });
                    throw error;
                }
                if (part.file.truncated) {
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: "Maximum file size exceeded.",
                    });
                    return reply
                        .code(413)
                        .send({
                            error: {
                                code: "FILE_TOO_LARGE",
                                message: "Maximum file size exceeded.",
                            },
                        });
                }
                broadcastUploadStatus(user.id, { uploadId, status: "processing", progress: 100 });
                const content = await readFile(temporaryPath);
                if (!hasImageSignature(content.subarray(0, 32), ext)) {
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: "Invalid image content.",
                    });
                    return reply
                        .code(400)
                        .send({
                            error: {
                                code: "INVALID_FILE",
                                message: "File content does not match its image type.",
                            },
                        });
                }
                const metadata = await sharp(content, { animated: true }).metadata();
                if (!metadata.width || !metadata.height) {
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: "Unable to read image dimensions.",
                    });
                    return reply
                        .code(400)
                        .send({
                            error: {
                                code: "INVALID_IMAGE",
                                message: "Unable to read image dimensions.",
                            },
                        });
                }
                const normalized = await sharp(content, { animated: true })
                    .rotate()
                    .toColorspace("srgb")
                    .toBuffer();
                const normalizedMetadata = await sharp(normalized, { animated: true }).metadata();
                const metadataJson = JSON.stringify({
                    format: metadata.format,
                    width: normalizedMetadata.width,
                    height: normalizedMetadata.height,
                    channels: metadata.channels,
                    depth: metadata.depth,
                    space: metadata.space,
                    density: metadata.density,
                    orientation: metadata.orientation,
                    hadExif: Boolean(metadata.exif),
                    hadIccProfile: Boolean(metadata.icc),
                    isProgressive: metadata.isProgressive,
                    pages: metadata.pages,
                    pageHeight: metadata.pageHeight,
                    loop: metadata.loop,
                });
                const contentHash = createHash("sha256").update(normalized).digest("hex");
                const existing = await prisma.upload.findFirst({
                    where: { userId: user.id, contentHash },
                });
                if (existing) {
                    await unlink(temporaryPath).catch(() => undefined);
                    uploads.push(existing);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "ready",
                        progress: 100,
                        url: uploadView(existing).url,
                    });
                    continue;
                }
                await unlink(temporaryPath).catch(() => undefined);
                const filename = `${contentHash}${ext}`;
                const destination = path.join(uploadDir, filename);
                await new Promise<void>(async (resolve, reject) => {
                    try {
                        await import("node:fs/promises").then(({ writeFile }) => writeFile(destination, normalized, { flag: "wx" }));
                        resolve();
                    } catch (error) {
                        if ((error as NodeJS.ErrnoException).code === "EEXIST") resolve();
                        else reject(error);
                    }
                });
                try {
                    const thumbhash = await generateThumbHash(destination);
                    const upload = await prisma.upload.create({
                        data: {
                            id: uploadId,
                            filename,
                            originalName: part.filename,
                            mimeType: part.mimetype,
                            size: normalized.byteLength,
                            width: normalizedMetadata.width,
                            height: normalizedMetadata.height,
                            contentHash,
                            thumbhash,
                            metadataJson,
                            userId: user.id,
                        },
                    });
                    uploads.push(upload);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "ready",
                        progress: 100,
                        url: uploadView(upload).url,
                    });
                    queueThumbnailGeneration(destination, cacheDir, upload.id);
                } catch (error) {
                    await unlink(destination).catch(() => undefined);
                    const duplicate = await prisma.upload.findFirst({
                        where: { userId: user.id, contentHash },
                    });
                    if (duplicate) {
                        uploads.push(duplicate);
                        broadcastUploadStatus(user.id, {
                            uploadId,
                            status: "ready",
                            progress: 100,
                            url: uploadView(duplicate).url,
                        });
                    } else {
                        broadcastUploadStatus(user.id, {
                            uploadId,
                            status: "failed",
                            error: "Upload failed.",
                        });
                        throw error;
                    }
                }
            }
        } catch (error) {
            request.log.error(error);
            return reply
                .code(500)
                .send({ error: { code: "UPLOAD_FAILED", message: "Upload failed." } });
        }
        if (!uploads.length)
            return reply
                .code(400)
                .send({ error: { code: "NO_FILE", message: "An image file is required." } });
        return reply
            .code(201)
            .send(ok(multiple ? uploads.map(uploadView) : uploadView(uploads[0])));
    });
    fastify.get("/v1/uploads/:uploadId", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { uploadId } = request.params as { uploadId: string };
        const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
        if (!upload)
            return reply
                .code(404)
                .send({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found." } });
        if (upload.userId !== user.id)
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You do not own this upload." } });
        return ok(uploadView(upload));
    });
    fastify.delete("/v1/uploads/:uploadId", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { uploadId } = request.params as { uploadId: string };
        const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
        if (!upload)
            return reply
                .code(404)
                .send({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found." } });
        if (upload.userId !== user.id)
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You do not own this upload." } });
        if (upload.postId)
            return reply
                .code(409)
                .send({
                    error: { code: "UPLOAD_IN_USE", message: "Upload is attached to a post." },
                });
        await prisma.upload.delete({ where: { id: uploadId } });
        const stillReferenced = await prisma.upload.count({ where: { filename: upload.filename } });
        if (!stillReferenced)
            await unlink(path.join(uploadDir, upload.filename)).catch(() => undefined);
        return reply.code(204).send();
    });
};
