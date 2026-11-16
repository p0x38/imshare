import type { FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { thumbHashToRGBA } from "thumbhash";
import { prisma } from "../lib/auth.js";
import { loadConfig } from "../lib/config.js";
import { uploadStorageDirectory } from "../lib/upload-storage.js";
import { queueThumbnailGeneration } from "../lib/thumbnails.js";
import {
    cacheMaxAgeSeconds,
    ensureCacheDirectory,
    getCacheSettings,
    readCacheFile,
    resolveCachePath,
} from "../lib/cache.js";
import { openapi, parameter } from "../lib/openapi-route.js";
import { observability } from "../instrumentation.js";
import { resolveCrawlerPolicy } from "../lib/crawler-policy.js";
import { resolveUploadStoragePath } from "../lib/upload-storage.js";
import {
    generateThumbnail,
    getThumbnailMimeType,
    type ThumbnailBackgroundStyle,
    type ThumbnailFit,
    type ThumbnailFormat,
    type ThumbnailOptions,
} from "../utils/thumbnail.js";

const THUMBNAIL_FORMATS = ["jpeg", "webp", "png", "avif"] as const;
const THUMBNAIL_FITS = ["cover", "contain", "fill", "inside", "outside"] as const;
const THUMBNAIL_BACKGROUND_STYLES = ["solid", "transparent", "blur"] as const;

const THUMBNAIL_POSITIONS = [
    "centre",
    "north",
    "south",
    "east",
    "west",
    "northeast",
    "northwest",
    "southeast",
    "southwest",
    "entropy",
    "attention",
] as const;

function parseThumbnailOptions(query: Record<string, unknown>): ThumbnailOptions {
    const parseNumber = (
        value: unknown,
        name: string,
        fallback: number,
        min: number,
        max: number,
    ): number => {
        if (value === undefined || value === "") return fallback;

        const parsed = Number(value);

        if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
            throw new Error(`INVALID_${name.toUpperCase()}`);
        }

        return parsed;
    };

    const parseEnum = <T extends string>(
        value: unknown,
        allowed: readonly T[],
        fallback: T,
        name: string,
    ): T => {
        if (value === undefined || value === "") return fallback;

        if (typeof value !== "string") {
            throw new Error(`INVALID_${name.toUpperCase()}`);
        }

        const matched = allowed.find((option) => option === value);

        if (matched === undefined) {
            throw new Error(`INVALID_${name.toUpperCase()}`);
        }

        return matched;
    };

    const background = query.background;

    if (
        background !== undefined &&
        (typeof background !== "string" || !/^#[\da-fA-F]{6}([0-9a-fA-F]{2})?$/.test(background))
    ) {
        throw new Error("INVALID_BACKGROUND");
    }

    const width = parseNumber(query.width, "width", 1200, 16, MAX_DIMENSION);
    const height = parseNumber(query.height, "height", 630, 16, MAX_DIMENSION);

    if (width * height > 16_000_000) {
        throw new Error("THUMBNAIL_TOO_LARGE");
    }

    const format = parseEnum(query.format, THUMBNAIL_FORMATS, "jpeg", "format");
    const backgroundStyle = parseEnum(
        query.backgroundStyle,
        THUMBNAIL_BACKGROUND_STYLES,
        "solid",
        "backgroundStyle",
    );

    if (backgroundStyle === "transparent" && format === "jpeg") {
        throw new Error("TRANSPARENT_BACKGROUND_REQUIRES_ALPHA_FORMAT");
    }

    return {
        width,
        height,
        fit: parseEnum(query.fit, THUMBNAIL_FITS, "contain", "fit") as ThumbnailFit,
        format: format as ThumbnailFormat,
        quality: parseNumber(query.quality, "quality", 82, 1, 100),
        background: (background as string | undefined) ?? "#121212",
        backgroundStyle: backgroundStyle as ThumbnailBackgroundStyle,
        position: parseEnum(query.position, THUMBNAIL_POSITIONS, "centre", "position"),
    };
}

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
            config: {
                rateLimit: {
                    max: 12_500,
                    timeWindow: "1 minute",
                    groupId: "public-image-reads",
                    onExceeded: () => {
                        observability.recordRateLimitHit("api_image_get");
                    },
                },
            },
        },
        async (request, reply) => {
            const { uploadId } = request.params as { uploadId: string };
            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
                select: { thumbhash: true },
            });
            if (!upload?.thumbhash)
                return reply.code(404).send({
                    error: {
                        code: "THUMBHASH_NOT_FOUND",
                        message: "Image placeholder is not available.",
                    },
                });
            try {
                const cachePath = resolveCachePath(
                    cacheDir,
                    `${uploadId}-thumbhash.png`,
                    cacheSettings.useHashedDirectory,
                );
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
                await writeFile(cachePath, output, { flag: "wx" })
                    .then(() => {
                        observability.recordCacheWrite("placeholder", output.byteLength);
                    })
                    .catch(() => {
                        observability.recordCacheError("placeholder");
                    });
                const etag = setCacheHeaders(reply, output, cacheSettings.ttl);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
                observability.recordImageServed();
                return reply.type("image/png").send(output);
            } catch {
                return reply.code(500).send({
                    error: {
                        code: "THUMBHASH_FAILED",
                        message: "The image placeholder could not be generated.",
                    },
                });
            }
        },
    );

    fastify.get(
        "/v1/posts/image/:uploadId/thumbnail",
        {
            schema: openapi({
                tags: "Images",
                summary: "Get Thumbnail image",
                description:
                    "Returns a cached, customizable thumbnail preview generated from a publicly accessible post image.",
                operationId: "getThumbnailImage",
                parameters: [
                    uploadId,
                    parameter.query(
                        "width",
                        { type: "integer", minimum: 16, maximum: MAX_DIMENSION, default: 1200 },
                        { description: "Output width in pixels." },
                    ),
                    parameter.query(
                        "height",
                        { type: "integer", minimum: 16, maximum: MAX_DIMENSION, default: 630 },
                        { description: "Output height in pixels." },
                    ),
                    parameter.query(
                        "fit",
                        { type: "string", enum: [...THUMBNAIL_FITS], default: "contain" },
                        { description: "Image resize strategy." },
                    ),
                    parameter.query(
                        "format",
                        { type: "string", enum: [...THUMBNAIL_FORMATS], default: "jpeg" },
                        { description: "Output image format." },
                    ),
                    parameter.query(
                        "quality",
                        { type: "integer", minimum: 1, maximum: 100, default: 82 },
                        { description: "Output quality for lossy formats." },
                    ),
                    parameter.query(
                        "background",
                        { type: "string", pattern: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$" },
                        { description: "Solid background color in hexadecimal." },
                    ),
                    parameter.query(
                        "backgroundStyle",
                        {
                            type: "string",
                            enum: [...THUMBNAIL_BACKGROUND_STYLES],
                            default: "solid",
                        },
                        { description: "Background rendering style." },
                    ),
                    parameter.query(
                        "position",
                        { type: "string", enum: [...THUMBNAIL_POSITIONS], default: "centre" },
                        { description: "Image crop position." },
                    ),
                    parameter.header("if-none-match", { type: "string" }),
                ],
                security: [{}],
                responses: {
                    "200": { description: "Generated thumbnail preview." },
                    "304": { description: "Preview has not changed." },
                    "404": { $ref: "#/components/responses/NotFound" },
                    "415": { description: "Image processing failed." },
                },
            }),
            config: {
                rateLimit: {
                    max: 12_500,
                    timeWindow: "1 minute",
                    groupId: "public-image-reads",
                    onExceeded: () => {
                        observability.recordRateLimitHit("api_image_get");
                    },
                },
            },
        },
        async (request, reply) => {
            const { uploadId } = request.params as { uploadId: string };

            const query = request.query as Record<string, unknown>;
            let options: ThumbnailOptions;

            try {
                options = parseThumbnailOptions(query);
            } catch (error) {
                const code = error instanceof Error ? error.message : "INVALID_THUMBNAIL_PARAMETER";

                return reply.code(400).send({
                    error: {
                        code,
                        message: "Invalid thumbnail parameters.",
                    },
                });
            }

            const optionsHash = createHash("sha256")
                .update(JSON.stringify(options))
                .digest("hex")
                .slice(0, 16);

            const format = options.format ?? "jpeg";

            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
                select: {
                    filename: true,
                    storageArea: true,
                    post: {
                        select: {
                            status: true,
                            visibility: true,
                            hiddenAt: true,
                            scheduledAt: true,
                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,
                            user: {
                                select: {
                                    allowSearchEngineIndex: true,
                                    allowAiCrawler: true,
                                    allowImageCrawler: true,
                                    allowCustomCrawler: true,
                                },
                            },
                        },
                    },
                },
            });

            const post = upload?.post;

            if (
                !upload ||
                upload.storageArea !== "uploads" ||
                !post ||
                post.status !== "published" ||
                !["public", "unlisted"].includes(post.visibility) ||
                post.hiddenAt ||
                (post.scheduledAt && post.scheduledAt > new Date())
            ) {
                return reply.code(404).send({
                    error: {
                        code: "IMAGE_NOT_FOUND",
                        message: "Thumbnail source not found.",
                    },
                });
            }

            const crawlerPolicy = resolveCrawlerPolicy(post.user, post);

            if (!crawlerPolicy.image) {
                reply.header("X-Robots-Tag", "noindex");
            }

            const cachePath = resolveCachePath(
                cacheDir,
                `${uploadId}-thumbnail-v1-${optionsHash}.${format}`,
                cacheSettings.useHashedDirectory,
            );

            try {
                const cached = await readCacheFile(cachePath, cacheSettings.ttl);

                if (cached) {
                    const etag = setCacheHeaders(reply, cached, cacheSettings.ttl);

                    if (request.headers["if-none-match"] === etag) {
                        return reply.code(304).send();
                    }

                    observability.recordImageServed();
                    return reply.type(getThumbnailMimeType(format)).send(cached);
                }
            } catch {
                observability.recordCacheError("thumbnail");
            }

            const sourcePath = resolveUploadStoragePath(uploadDir, upload.filename);

            if (!sourcePath) {
                return reply.code(404).send({
                    error: {
                        code: "IMAGE_NOT_FOUND",
                        message: "Image file not found.",
                    },
                });
            }

            let source: Buffer;

            try {
                source = await readFile(sourcePath);
            } catch {
                return reply.code(404).send({
                    error: {
                        code: "IMAGE_NOT_FOUND",
                        message: "Image file not found.",
                    },
                });
            }

            const startedAt = process.hrtime.bigint();

            try {
                const output = await generateThumbnail(source, options);

                await mkdir(path.dirname(cachePath), { recursive: true });

                await writeFile(cachePath, output, { flag: "wx" })
                    .then(() => {
                        observability.recordCacheWrite("thumbnail", output.byteLength);
                    })
                    .catch((error) => {
                        if ((error as NodeJS.ErrnoException).code === "EEXIST") return;

                        observability.recordCacheError("thumbnail");
                        throw error;
                    });

                observability.recordImageProcessing(
                    Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
                    "thumbnail",
                );

                const etag = setCacheHeaders(reply, output, cacheSettings.ttl);

                if (request.headers["if-none-match"] === etag) {
                    return reply.code(304).send();
                }

                observability.recordImageServed();
                return reply.type(getThumbnailMimeType(format)).send(output);
            } catch (error) {
                observability.recordImageProcessingError("thumbnail");
                request.log.error(error);

                return reply.code(415).send({
                    error: {
                        code: "THUMBNAIL_IMAGE_GENERATION_FAILED",
                        message: "The thumbnail could not be generated.",
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
            config: {
                rateLimit: {
                    max: 12_500,
                    timeWindow: "1 minute",
                    groupId: "public-image-reads",
                    onExceeded: () => {
                        observability.recordRateLimitHit("api_image_get");
                    },
                },
            },
        },
        async (request, reply) => {
            const { uploadId } = request.params as { uploadId: string };
            const query = request.query as Record<string, unknown>;
            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
                include: {
                    user: {
                        select: {
                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,
                        },
                    },
                    post: {
                        select: {
                            allowDownload: true,
                            userId: true,

                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,

                            user: {
                                select: {
                                    allowSearchEngineIndex: true,
                                    allowAiCrawler: true,
                                    allowImageCrawler: true,
                                    allowCustomCrawler: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!upload)
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });

            const crawlerOwner = upload.post?.user ?? upload.user;

            const crawlerPolicy = resolveCrawlerPolicy(crawlerOwner, upload.post);

            if (!crawlerPolicy.image) {
                reply.header("X-Robots-Tag", "noindex");
            }

            const sourceDirectory =
                upload.storageArea === "avatars"
                    ? uploadStorageDirectory(config, "avatars")
                    : uploadDir;
            const source = path.resolve(sourceDirectory, upload.filename);
            const relative = path.relative(sourceDirectory, source);
            if (relative.startsWith("..") || path.isAbsolute(relative))
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
            let sourceContent: Buffer;
            try {
                sourceContent = await readFile(source);
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
                return reply.code(403).send({
                    error: {
                        code: "DOWNLOAD_DISABLED",
                        message: "The creator has disabled downloads for this image.",
                    },
                });
            if (!transformed) {
                const output = sourceContent;
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
                    queueThumbnailGeneration(sourceContent, upload.id);
                let pipeline = sharp(sourceContent, { animated: false });
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
                await writeFile(cached, output, { flag: "wx" })
                    .then(() => {
                        observability.recordCacheWrite("image", output.byteLength);
                    })
                    .catch(async (error) => {
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
                return reply.code(415).send({
                    error: {
                        code: "IMAGE_PROCESSING_FAILED",
                        message: "The image could not be processed.",
                    },
                });
            }
        },
    );
};
