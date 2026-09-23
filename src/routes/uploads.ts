import type { FastifyPluginAsync } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";
import { loadConfig } from "../lib/config.js";
import { uploadStorageDirectory, type UploadStorageArea } from "../lib/upload-storage.js";
import { broadcastUploadStatus } from "../lib/realtime.js";
import { generateThumbHash, queueThumbnailGeneration } from "../lib/thumbnails.js";
import { observability } from "../instrumentation.js";
import {
    GIF_SHARP_PIXEL_LIMIT,
    validateGifMetadata,
} from "../lib/gif-security.js";

const IMAGE_TYPES = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".gif", "image/gif"],
    [".webp", "image/webp"],
    [".bmp", "image/bmp"],
    [".avif", "image/avif"],
]);
const IMAGE_EXTENSIONS = new Map(
    Array.from(IMAGE_TYPES.entries(), ([extension, mime]) => [mime, extension]),
);
function uploadView(upload: any) {
    const prefix = upload.storageArea === "avatars" ? "/avatars/" : "/uploads/";
    return {
        ...upload,
        url: `${prefix}${String(upload.filename).replaceAll("\\", "/")}`,
    };
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const uploadDir = uploadStorageDirectory(config, "uploads");
    const avatarDir = uploadStorageDirectory(config, "avatars");
    await mkdir(uploadDir, { recursive: true });
    await mkdir(avatarDir, { recursive: true });
    fastify.post("/v1/uploads", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const query = request.query as Record<string, unknown>;
        const storageArea: UploadStorageArea =
            query.area === "avatar" || query.area === "avatars" ? "avatars" : "uploads";
        const targetDirectory = storageArea === "avatars" ? avatarDir : uploadDir;
        const multiple = query.multiple === "true";
        const parts = request.parts({
            limits: { files: multiple ? 20 : 1, fileSize: config.storage.maxFileSize, fields: 4 },
        });
        const uploads: any[] = [];
        try {
            for await (const part of parts) {
                if (part.type !== "file") continue;
                const uploadId = randomUUID();
                const uploadStartedAt = process.hrtime.bigint();
                const declaredExt = path.extname(part.filename).toLowerCase();
                const declaredMime = part.mimetype || "unknown";
                const declaredTypeSupported =
                    IMAGE_TYPES.has(declaredExt) ||
                    Array.from(IMAGE_TYPES.values()).includes(part.mimetype);
                if (!declaredTypeSupported) {
                    part.file.resume();
                    const message = `File "${part.filename}" is not recognized as a supported image upload. Supported types are JPEG, PNG, GIF, WebP, BMP, and AVIF.`;
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: message,
                    });
                    observability.recordUploadError("invalid_type");
                    return reply.code(400).send({
                        error: { code: "INVALID_FILE", message },
                    });
                }
                broadcastUploadStatus(user.id, { uploadId, status: "uploading", progress: 0 });
                const temporaryPath = path.join(targetDirectory, `.upload-${uploadId}`);
                try {
                    await pipeline(part.file, createWriteStream(temporaryPath, { flags: "wx" }));
                } catch (error) {
                    await unlink(temporaryPath).catch(() => undefined);
                    const cancelled =
                        (error as NodeJS.ErrnoException).name === "AbortError" ||
                        request.raw.destroyed;
                    const message = cancelled
                        ? undefined
                        : `Failed to read file "${part.filename}" while uploading.`;
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: cancelled ? "cancelled" : "failed",
                        error: message,
                    });
                    if (cancelled)
                        return reply.code(499).send({
                            error: { code: "UPLOAD_CANCELLED", message: "Upload cancelled." },
                        });
                    throw error;
                }
                if (part.file.truncated) {
                    observability.recordUploadError("file_too_large");
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: "Maximum file size exceeded.",
                    });
                    return reply.code(413).send({
                        error: {
                            code: "FILE_TOO_LARGE",
                            message: `File "${part.filename}" exceeds the maximum allowed upload size.`,
                        },
                    });
                }
                broadcastUploadStatus(user.id, { uploadId, status: "processing", progress: 100 });
                const content = await readFile(temporaryPath);
                const isGif = content.subarray(0, 6).toString("ascii") === "GIF87a" ||
                    content.subarray(0, 6).toString("ascii") === "GIF89a";
                let metadata;
                try {
                    metadata = await sharp(content).metadata();
                } catch {
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: `File "${part.filename}" is not a valid supported image.`,
                    });
                    observability.recordUploadError("invalid_content");
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_FILE",
                            message: `File "${part.filename}" is not a valid supported image.`,
                        },
                    });
                }
                const detectedIsGif = metadata.format === "gif";
                if (detectedIsGif) {
                    try {
                        validateGifMetadata(metadata);
                    } catch (error) {
                        await unlink(temporaryPath).catch(() => undefined);
                        const message =
                            error instanceof Error
                                ? `File "${part.filename}" is unsafe to process: ${error.message}`
                                : `File "${part.filename}" has an animation that exceeds imshare's GIF safety limits.`;
                        broadcastUploadStatus(user.id, {
                            uploadId,
                            status: "failed",
                            error: message,
                        });
                        observability.recordUploadError("gif_safety_limit");
                        return reply.code(413).send({
                            error: { code: "GIF_SAFETY_LIMIT", message },
                        });
                    }
                }
                const sharpOptions = {
                    animated: true,
                    ...(detectedIsGif ? { limitInputPixels: GIF_SHARP_PIXEL_LIMIT } : {}),
                };
                const detectedMime = metadata.mediaType;
                const detectedExt = detectedMime ? IMAGE_EXTENSIONS.get(detectedMime) : undefined;
                if (!detectedMime || !detectedExt) {
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: `File "${part.filename}" is a ${detectedMime ?? "unknown"} format, which imshare does not support.`,
                    });
                    observability.recordUploadError("invalid_content");
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_FILE",
                            message: `File "${part.filename}" is a ${detectedMime ?? "unknown"} format, which imshare does not support.`,
                        },
                    });
                }
                if (!metadata.width || !metadata.height) {
                    await unlink(temporaryPath).catch(() => undefined);
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "failed",
                        error: `File "${part.filename}" has no readable image dimensions.`,
                    });
                    observability.recordUploadError("invalid_dimensions");
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_IMAGE",
                            message: `File "${part.filename}" has no readable image dimensions.`,
                        },
                    });
                }
                const normalized = await sharp(content, sharpOptions)
                    .rotate()
                    .toColorspace("srgb")
                    .toBuffer();
                const normalizedMetadata = await sharp(normalized, sharpOptions).metadata();
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
                    where: { userId: user.id, contentHash, storageArea },
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
                const filename = `${contentHash}${detectedExt}`;
                const relativeFilename = path.posix.join(
                    contentHash.slice(0, 2),
                    contentHash.slice(0, 4),
                    filename,
                );
                const destination = path.join(targetDirectory, relativeFilename);
                await mkdir(path.dirname(destination), { recursive: true });
                await writeFile(destination, normalized, { flag: "wx" }).catch(
                    (error: NodeJS.ErrnoException) => {
                        if (error.code !== "EEXIST") throw error;
                    },
                );
                try {
                    const thumbhash = await generateThumbHash(destination);
                    const upload = await prisma.upload.create({
                        data: {
                            id: uploadId,
                            filename: relativeFilename,
                            originalName: part.filename,
                            mimeType: detectedMime,
                            size: normalized.byteLength,
                            width: normalizedMetadata.width,
                            height: normalizedMetadata.height,
                            contentHash,
                            thumbhash,
                            metadataJson,
                            userId: user.id,
                            storageArea,
                        },
                    });
                    uploads.push(upload);
                    observability.recordUpload(
                        normalized.byteLength,
                        detectedMime,
                        Number(process.hrtime.bigint() - uploadStartedAt) / 1_000_000_000,
                    );
                    broadcastUploadStatus(user.id, {
                        uploadId,
                        status: "ready",
                        progress: 100,
                        url: uploadView(upload).url,
                    });
                    queueThumbnailGeneration(destination, upload.id);
                } catch (error) {
                    await unlink(destination).catch(() => undefined);
                    const duplicate = await prisma.upload.findFirst({
                        where: { userId: user.id, contentHash, storageArea },
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
                        observability.recordUploadError("persist");
                        broadcastUploadStatus(user.id, {
                            uploadId,
                            status: "failed",
                            error: `Failed to store file "${part.filename}".`,
                        });
                        throw error;
                    }
                }
            }
        } catch (error) {
            request.log.error(error);
            return reply
                .code(500)
                .send({
                    error: {
                        code: "UPLOAD_FAILED",
                        message: "Upload processing failed" +
                            (uploads.length === 0 ? "." : ". One or more files could not be processed."),
                    },
                });
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
    fastify.get("/uploads/*", async (request, reply) => {
        const rawPath = String((request.params as Record<string, unknown>)["*"] ?? "").replaceAll(
            "\\",
            "/",
        );
        if (!rawPath || rawPath.includes(".."))
            return reply.code(404).send({
                error: { code: "IMAGE_NOT_FOUND", message: "Image not found." },
            });

        const upload = await prisma.upload.findFirst({
            where: { filename: rawPath },
            select: { filename: true, mimeType: true, contentHash: true, size: true },
        });
        if (!upload)
            return reply.code(404).send({
                error: { code: "IMAGE_NOT_FOUND", message: "Image not found." },
            });

        const source = path.resolve(uploadDir, upload.filename);
        const relative = path.relative(uploadDir, source);
        if (relative.startsWith("..") || path.isAbsolute(relative))
            return reply.code(404).send({
                error: { code: "IMAGE_NOT_FOUND", message: "Image not found." },
            });

        try {
            const etag = upload.contentHash ? `"${upload.contentHash}"` : undefined;
            reply
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Length", String(upload.size));
            if (etag) {
                reply.header("ETag", etag);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
            }
            reply.type(upload.mimeType);
            return reply.send(createReadStream(source));
        } catch {
            return reply.code(404).send({
                error: { code: "IMAGE_NOT_FOUND", message: "Image file not found." },
            });
        }
    });

    fastify.get("/avatars/*", async (request, reply) => {
        const rawPath = String((request.params as Record<string, unknown>)["*"] ?? "").replaceAll("\\", "/");
        if (!rawPath || rawPath.includes(".."))
            return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
        const upload = await prisma.upload.findFirst({
            where: { filename: rawPath, storageArea: "avatars" },
            select: { filename: true, mimeType: true, contentHash: true, size: true },
        });
        if (!upload)
            return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
        const source = path.resolve(avatarDir, upload.filename);
        const relative = path.relative(avatarDir, source);
        if (relative.startsWith("..") || path.isAbsolute(relative))
            return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
        try {
            const etag = upload.contentHash ? `"${upload.contentHash}"` : undefined;
            reply.header("Cache-Control", "public, max-age=31536000, immutable").header("X-Content-Type-Options", "nosniff").header("Content-Length", String(upload.size));
            if (etag) {
                reply.header("ETag", etag);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
            }
            reply.type(upload.mimeType);
            return reply.send(createReadStream(source));
        } catch {
            return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image file not found." } });
        }
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
            return reply.code(409).send({
                error: { code: "UPLOAD_IN_USE", message: "Upload is attached to a post." },
            });
        await prisma.upload.delete({ where: { id: uploadId } });
        const stillReferenced = await prisma.upload.count({
            where: { filename: upload.filename, storageArea: upload.storageArea },
        });
        if (!stillReferenced) {
            const directory = upload.storageArea === "avatars" ? avatarDir : uploadDir;
            await unlink(path.join(directory, upload.filename)).catch(() => undefined);
        }
        return reply.code(204).send();
    });
};
