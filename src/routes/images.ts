import type { FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { thumbHashToRGBA } from "thumbhash";
import { prisma } from "../lib/auth.js";
import { loadConfig } from "../lib/config.js";
import { uploadStorageDirectory } from "../lib/upload-storage.js";
import { queueThumbnailGeneration } from "../lib/thumbnails.js";
import { cacheMaxAgeSeconds, ensureCacheDirectory, getCacheSettings, readCacheFile, resolveCachePath } from "../lib/cache.js";
import { openapi, parameter } from "../lib/openapi-route.js";
import { observability } from "../instrumentation.js";

const MAX_DIMENSION = 4096;
const MIN_DIMENSION = 16;
const FORMATS = {
    webp: { mime: "image/webp" },
    jpeg: { mime: "image/jpeg" },
    jpg: { mime: "image/jpeg" },
    png: { mime: "image/png" },
    avif: { mime: "image/avif" },
} as const;
type ImageFormat = keyof typeof FORMATS;
type Fit = "cover" | "contain" | "fill" | "inside" | "outside";
function parseDimension(value: unknown): number | undefined {
    if (value === undefined || value === "") return undefined;
    const dimension = Number(value);
    if (!Number.isInteger(dimension) || dimension < MIN_DIMENSION || dimension > MAX_DIMENSION)
        throw new Error("INVALID_DIMENSION");
    return dimension;
}
function parseFit(value: unknown): Fit {
    if (value === undefined || value === "") return "inside";
    if (["cover", "contain", "fill", "inside", "outside"].includes(String(value)))
        return value as Fit;
    throw new Error("INVALID_FIT");
}
function parseFormat(value: unknown): ImageFormat | undefined {
    if (value === undefined || value === "") return undefined;
    if (typeof value !== "string" || !(value in FORMATS)) throw new Error("INVALID_FORMAT");
    return value as ImageFormat;
}
function cacheKey(
    uploadId: string,
    width?: number,
    height?: number,
    fit?: Fit,
    format?: ImageFormat,
) {
    return `${uploadId}-${width ?? "auto"}x${height ?? "auto"}-${fit ?? "inside"}.${format ?? "source"}`;
}
function setCacheHeaders(reply: any, output: Buffer, ttl: number) {
    const etag = `"${createHash("sha256").update(output).digest("hex")}"`;
    reply.header("Cache-Control", `public, max-age=${cacheMaxAgeSeconds(ttl)}, immutable`);
    reply.header("ETag", etag);
    reply.header("X-Content-Type-Options", "nosniff");
    return etag;
}

export const imageRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const uploadDir = uploadStorageDirectory(config, "uploads");
    const cacheSettings = getCacheSettings(config);
    const cacheDir = await ensureCacheDirectory(config);
    const uploadId = parameter.path("uploadId", { type: "string" }, { description: "Upload ID." });
    const transformParameters = [
        uploadId,
        parameter.query(
            "width",
            { type: "integer", minimum: MIN_DIMENSION, maximum: MAX_DIMENSION },
            { description: "Output width in pixels." },
        ),
        parameter.query(
            "height",
            { type: "integer", minimum: MIN_DIMENSION, maximum: MAX_DIMENSION },
            { description: "Output height in pixels." },
        ),
        parameter.query(
            "fit",
            {
                type: "string",
                enum: ["cover", "contain", "fill", "inside", "outside"],
                default: "inside",
            },
            { description: "Resize fit strategy." },
        ),
        parameter.query(
            "format",
            { type: "string", enum: Object.keys(FORMATS) },
            { description: "Optional output image format." },
        ),
        parameter.query(
            "download",
            { type: "boolean", default: false },
            { description: "Request the original image as a download when allowed." },
        ),
        parameter.header(
            "if-none-match",
            { type: "string" },
            { description: "Conditional request entity tag." },
        ),
    ];
    fastify.get(
        "/v1/posts/image/:uploadId/placeholder",
        {
            schema: openapi({
                tags: "Images",
                summary: "Get image placeholder",
                description: "Returns a PNG placeholder generated from the upload's thumbhash.",
                operationId: "getImagePlaceholder",
                parameters: [uploadId, parameter.header("if-none-match", { type: "string" })],
                security: [{}],
                responses: {
                    "200": { description: "PNG placeholder image." },
                    "304": { description: "Placeholder has not changed." },
                    "404": { $ref: "#/components/responses/NotFound" },
                    "500": { description: "Placeholder generation failed." },
                },
            }),
        },
        async (request, reply) => {
            const { uploadId } = request.params as { uploadId: string };
            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
                select: { thumbhash: true },
            });
            if (!upload?.thumbhash)
                return reply
                    .code(404)
                    .send({
                        error: {
                            code: "THUMBHASH_NOT_FOUND",
                            message: "Image placeholder is not available.",
                        },
                    });
            try {
                const cachePath = resolveCachePath(cacheDir, `${uploadId}-thumbhash.png`, cacheSettings.useHashedDirectory);
                try {
                    const cached = await readCacheFile(cachePath, cacheSettings.ttl);
                    if (!cached) throw new Error("CACHE_MISS");
                    const etag = setCacheHeaders(reply, cached, cacheSettings.ttl);
                    if (request.headers["if-none-match"] === etag) return reply.code(304).send();
                    observability.recordImageServed();
                    return reply.type("image/png").send(cached);
                } catch {}
                const image = thumbHashToRGBA(
                    new Uint8Array(Buffer.from(upload.thumbhash, "base64")),
                );
                const output = await sharp(Buffer.from(image.rgba), {
                    raw: { width: image.w, height: image.h, channels: 4 },
                })
                    .png()
                    .toBuffer();
                await mkdir(path.dirname(cachePath), { recursive: true });
                await writeFile(cachePath, output, { flag: "wx" }).then(() => {
                    observability.recordCacheWrite("placeholder", output.byteLength);
                }).catch(() => {
                    observability.recordCacheError("placeholder");
                });
                const etag = setCacheHeaders(reply, output, cacheSettings.ttl);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
                observability.recordImageServed();
                return reply.type("image/png").send(output);
            } catch {
                return reply
                    .code(500)
                    .send({
                        error: {
                            code: "THUMBHASH_FAILED",
                            message: "The image placeholder could not be generated.",
                        },
                    });
            }
        },
    );
    fastify.get(
        "/v1/posts/image/:uploadId",
        {
            schema: openapi({
                tags: "Images",
                summary: "Get an image",
                description: "Returns an original upload or an on-demand transformed image.",
                operationId: "getImage",
                parameters: transformParameters,
                security: [{}],
                responses: {
                    "200": { description: "Image data." },
                    "304": { description: "Image has not changed." },
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "404": { $ref: "#/components/responses/NotFound" },
                    "415": { description: "Image processing failed." },
                },
            }),
        },
        async (request, reply) => {
            const { uploadId } = request.params as { uploadId: string };
            const query = request.query as Record<string, unknown>;
            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
                include: { post: { select: { allowDownload: true, userId: true } } },
            });
            if (!upload)
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
            const sourceDirectory = upload.storageArea === "avatars"
            ? uploadStorageDirectory(config, "avatars")
            : uploadDir;
        const source = path.resolve(sourceDirectory, upload.filename);
            const relative = path.relative(sourceDirectory, source);
            if (relative.startsWith("..") || path.isAbsolute(relative))
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
            try {
                await access(source);
            } catch {
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image file not found." } });
            }
            let width: number | undefined;
            let height: number | undefined;
            let fit: Fit;
            let format: ImageFormat | undefined;
            try {
                width = parseDimension(query.width);
                height = parseDimension(query.height);
                fit = parseFit(query.fit);
                format = parseFormat(query.format);
            } catch (error) {
                const code = error instanceof Error ? error.message : "INVALID_IMAGE_PARAMETER";
                return reply
                    .code(400)
                    .send({ error: { code, message: "Invalid image transformation parameters." } });
            }
            const transformed = width !== undefined || height !== undefined || format !== undefined;
            if (query.download === "true" && upload.post && !upload.post.allowDownload)
                return reply
                    .code(403)
                    .send({
                        error: {
                            code: "DOWNLOAD_DISABLED",
                            message: "The creator has disabled downloads for this image.",
                        },
                    });
            if (!transformed) {
                const output = await readFile(source);
                const etag = setCacheHeaders(reply, output, cacheSettings.ttl);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
                reply.type(upload.mimeType);
                if (query.download === "true")
                    reply.header(
                        "Content-Disposition",
                        `attachment; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`,
                    );
                observability.recordImageServed();
                return reply.send(output);
            }
            const key = cacheKey(upload.id, width, height, fit, format);
            const cached = resolveCachePath(cacheDir, key, cacheSettings.useHashedDirectory);
            try {
                const output = await readCacheFile(cached, cacheSettings.ttl);
                if (!output) throw new Error("CACHE_MISS");
                const etag = setCacheHeaders(reply, output, cacheSettings.ttl);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
                reply.type(format ? FORMATS[format].mime : upload.mimeType);
                observability.recordImageServed();
                return reply.send(output);
            } catch {}
            const processingStartedAt = process.hrtime.bigint();
            try {
                if (
                    width !== undefined &&
                    height === undefined &&
                    fit === "inside" &&
                    format === "webp" &&
                    [320, 640, 1280].includes(width)
                )
                    queueThumbnailGeneration(source, upload.id);
                let pipeline = sharp(source, { animated: false });
                if (width !== undefined || height !== undefined)
                    pipeline = pipeline.resize({ width, height, fit, withoutEnlargement: true });
                if (format !== undefined) {
                    const targetFormat = format === "jpg" ? "jpeg" : format;
                    pipeline = pipeline.toFormat(
                        targetFormat,
                        targetFormat === "jpeg" || targetFormat === "png"
                            ? { progressive: true }
                            : {},
                    );
                    reply.type(FORMATS[format].mime);
                } else reply.type(upload.mimeType);
                const output = await pipeline.toBuffer();
                await mkdir(path.dirname(cached), { recursive: true });
                await writeFile(cached, output, { flag: "wx" }).then(() => {
                    observability.recordCacheWrite("image", output.byteLength);
                }).catch(async (error) => {
                    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
                    observability.recordCacheError("image");
                    throw error;
                });
                observability.recordImageProcessing(
                    Number(process.hrtime.bigint() - processingStartedAt) / 1_000_000_000,
                    "transform",
                );
                observability.recordImageTransformation("transform", format);
                const etag = setCacheHeaders(reply, output, cacheSettings.ttl);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
                observability.recordImageServed();
                return reply.send(output);
            } catch (error) {
                observability.recordImageProcessingError("transform");
                request.log.error(error);
                return reply
                    .code(415)
                    .send({
                        error: {
                            code: "IMAGE_PROCESSING_FAILED",
                            message: "The image could not be processed.",
                        },
                    });
            }
        },
    );
};
