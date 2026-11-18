import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";
import { getApiToken, permissionsAllow } from "../lib/api-tokens.js";
import { loadConfig } from "../lib/config.js";
import { permalinkBase } from "../lib/post-permalink.js";
import {
    resolveUploadStoragePath,
    uploadStorageDirectory,
    type UploadStorageArea,
} from "../lib/upload-storage.js";
import { broadcastUploadStatus } from "../lib/realtime.js";
import { generateThumbHash, queueThumbnailGeneration } from "../lib/thumbnails.js";
import { observability } from "../instrumentation.js";
import { GIF_SHARP_PIXEL_LIMIT, validateGifMetadata } from "../lib/gif-security.js";
import { openapi } from "../lib/openapi-route.js";
import {
    isPostyBirbSourceUrl,
    mergePostyBirbUploadMetadata,
    parsePostyBirbTags,
    postyBirbDescriptionToText,
} from "../lib/postybirb.js";
import { findTags, postInclude, postView } from "./_shared.js";
import { resolveCrawlerPolicy } from "../lib/crawler-policy.js";

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

interface PendingFileMetadata {
    alt?: string;
    sourceUrls: string[];
}

class UploadAlreadyAttachedError extends Error {
    constructor() {
        super("One or more uploads have already been attached to a post.");
        this.name = "UploadAlreadyAttachedError";
    }
}

function uploadView(upload: any) {
    const prefix = upload.storageArea === "avatars" ? "/api/v1/avatars/" : "/uploads/";

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

    const handleUpload = async (
        request: FastifyRequest,
        reply: FastifyReply,
        createPost = false,
    ) => {
        const user = await requireUser(request, reply);
        if (!user) return;

        if (createPost && !request.isMultipart()) {
            return reply.code(415).send({
                error: {
                    code: "UNSUPPORTED_MEDIA_TYPE",
                    message: "Expected multipart/form-data.",
                },
            });
        }

        if (createPost) {
            const apiToken = await getApiToken(request);

            if (apiToken && !permissionsAllow(apiToken.permissions, "uploads", "write")) {
                return reply.code(403).send({
                    error: {
                        code: "API_TOKEN_PERMISSION_DENIED",
                        message: "The API token requires uploads: write permission.",
                    },
                });
            }
        }

        const query = request.query as Record<string, unknown>;

        const storageArea: UploadStorageArea =
            !createPost && (query.area === "avatar" || query.area === "avatars")
                ? "avatars"
                : "uploads";

        const targetDirectory = storageArea === "avatars" ? avatarDir : uploadDir;
        const multiple = createPost || query.multiple === "true";
        const postyBirb = createPost || query.client === "postybirb";

        const uploads: any[] = [];
        const uploadPartIndices: number[] = [];
        const createdUploadIds: string[] = [];
        const postFields = new Map<string, string>();
        const fileMetadata = new Map<number, PendingFileMetadata>();

        let fileIndex = 0;
        let preserveCreatedUploads = !createPost;
        let processingStage: "upload" | "post" = "upload";

        const cleanupCreatedUploads = async () => {
            for (const uploadId of createdUploadIds) {
                try {
                    const upload = await prisma.upload.findUnique({
                        where: { id: uploadId },
                    });

                    if (!upload || upload.postId) continue;

                    const deleted = await prisma.upload.deleteMany({
                        where: {
                            id: uploadId,
                            userId: user.id,
                            postId: null,
                        },
                    });

                    if (!deleted.count) continue;

                    const stillReferenced = await prisma.upload.count({
                        where: {
                            filename: upload.filename,
                            storageArea: upload.storageArea,
                        },
                    });

                    if (!stillReferenced) {
                        const directory = upload.storageArea === "avatars" ? avatarDir : uploadDir;

                        await unlink(path.join(directory, upload.filename)).catch(() => undefined);
                    }
                } catch (error) {
                    request.log.error(
                        { err: error, uploadId },
                        "Failed to clean up an uncommitted upload",
                    );
                }
            }
        };

        try {
            const parts = request.parts({
                limits: {
                    files: multiple ? 20 : 1,
                    fileSize: config.storage.maxFileSize,
                    fields: postyBirb ? 128 : 4,
                    ...(postyBirb ? { fieldSize: 64 * 1024 } : {}),
                },
            });

            for await (const part of parts) {
                if (part.type !== "file") {
                    if (!createPost) continue;

                    if (part.valueTruncated) {
                        return reply.code(413).send({
                            error: {
                                code: "FIELD_TOO_LARGE",
                                message: `The "${part.fieldname}" field exceeds the allowed size.`,
                            },
                        });
                    }

                    const fieldName = part.fieldname;
                    const value = part.value;

                    if (typeof value !== "string") continue;

                    if (["title", "description", "tags", "rating"].includes(fieldName)) {
                        if (postFields.has(fieldName)) {
                            return reply.code(400).send({
                                error: {
                                    code: "DUPLICATE_FIELD",
                                    message: `The "${fieldName}" field must only be provided once.`,
                                },
                            });
                        }

                        postFields.set(fieldName, value);
                        continue;
                    }

                    const altMatch = /^altText\[(\d+)\]$/.exec(fieldName);
                    const sourceMatch = /^sourceUrls\[(\d+)\]$/.exec(fieldName);
                    const match = altMatch ?? sourceMatch;

                    if (!match) continue;

                    const index = Number(match[1]);

                    if (!Number.isSafeInteger(index) || index < 0 || index >= 20) {
                        return reply.code(400).send({
                            error: {
                                code: "INVALID_FILE_METADATA",
                                message: `Invalid file metadata index in "${fieldName}".`,
                            },
                        });
                    }

                    const metadata = fileMetadata.get(index) ?? {
                        sourceUrls: [],
                    };

                    if (altMatch) {
                        if (metadata.alt !== undefined) {
                            return reply.code(400).send({
                                error: {
                                    code: "DUPLICATE_FIELD",
                                    message: `The "${fieldName}" field must only be provided once.`,
                                },
                            });
                        }

                        metadata.alt = value;
                    } else {
                        metadata.sourceUrls.push(value);
                    }

                    fileMetadata.set(index, metadata);
                    continue;
                }

                if (createPost && part.fieldname !== "file") {
                    part.file.resume();

                    return reply.code(400).send({
                        error: {
                            code: "UNSUPPORTED_FILE_FIELD",
                            message:
                                "PostyBirb image submissions must use the file field. Leave the thumbnail field unset.",
                        },
                    });
                }

                const currentFileIndex = fileIndex++;
                const uploadId = randomUUID();
                const uploadStartedAt = process.hrtime.bigint();
                const declaredExt = path.extname(part.filename).toLowerCase();

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

                broadcastUploadStatus(user.id, {
                    uploadId,
                    status: "uploading",
                    progress: 0,
                });

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

                    if (cancelled) {
                        return reply.code(499).send({
                            error: {
                                code: "UPLOAD_CANCELLED",
                                message: "Upload cancelled.",
                            },
                        });
                    }

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

                broadcastUploadStatus(user.id, {
                    uploadId,
                    status: "processing",
                    progress: 100,
                });

                const content = await readFile(temporaryPath);

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
                    where: {
                        userId: user.id,
                        contentHash,
                        storageArea,
                    },
                });

                if (existing) {
                    await unlink(temporaryPath).catch(() => undefined);

                    if (createPost && existing.postId) {
                        return reply.code(409).send({
                            error: {
                                code: "UPLOAD_IN_USE",
                                message: `File "${part.filename}" is already attached to another post.`,
                            },
                        });
                    }

                    uploads.push(existing);
                    uploadPartIndices.push(currentFileIndex);

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

                let destinationCreated = false;

                try {
                    await writeFile(destination, normalized, { flag: "wx" });
                    destinationCreated = true;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
                        throw error;
                    }
                }

                let upload: any;

                try {
                    const thumbhash = await generateThumbHash(destination);

                    upload = await prisma.upload.create({
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

                    createdUploadIds.push(upload.id);
                } catch (error) {
                    const duplicate = await prisma.upload.findFirst({
                        where: {
                            userId: user.id,
                            contentHash,
                            storageArea,
                        },
                    });

                    if (duplicate) {
                        if (createPost && duplicate.postId) {
                            return reply.code(409).send({
                                error: {
                                    code: "UPLOAD_IN_USE",
                                    message: `File "${part.filename}" is already attached to another post.`,
                                },
                            });
                        }

                        upload = duplicate;
                    } else {
                        if (destinationCreated) {
                            await unlink(destination).catch(() => undefined);
                        }

                        throw error;
                    }
                }

                uploads.push(upload);
                uploadPartIndices.push(currentFileIndex);

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

                if (upload.id === uploadId) {
                    queueThumbnailGeneration(normalized, upload.id);
                }
            }

            if (!uploads.length) {
                return reply.code(400).send({
                    error: {
                        code: "NO_FILE",
                        message: "An image file is required.",
                    },
                });
            }

            if (!createPost) {
                preserveCreatedUploads = true;

                return reply
                    .code(postyBirb ? 200 : 201)
                    .send(ok(multiple ? uploads.map(uploadView) : uploadView(uploads[0])));
            }

            processingStage = "post";

            const title = postFields.get("title")?.trim() ?? "";
            const rawDescription = postFields.get("description") ?? "";
            const description = postyBirbDescriptionToText(rawDescription);
            const tagNames = parsePostyBirbTags(postFields.get("tags") ?? "");
            const rating = postFields.get("rating")?.trim().toUpperCase() || "GENERAL";

            if (!title || title.length > 500) {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_TITLE",
                        message: "A title between 1 and 500 characters is required.",
                    },
                });
            }

            if (description.length > 10000) {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_DESCRIPTION",
                        message: "The description exceeds 10,000 characters.",
                    },
                });
            }

            if (tagNames.length > 100 || tagNames.some((tag) => tag.length > 100)) {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_TAGS",
                        message:
                            "A maximum of 100 tags is allowed, with at most 100 characters per tag.",
                    },
                });
            }

            if (rating.length > 32) {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_RATING",
                        message: "The rating field is too long.",
                    },
                });
            }

            if (new Set(uploads.map((upload) => upload.id)).size !== uploads.length) {
                return reply.code(409).send({
                    error: {
                        code: "DUPLICATE_IMAGE",
                        message:
                            "The same image cannot appear more than once in a single post batch.",
                    },
                });
            }

            for (const index of fileMetadata.keys()) {
                if (index >= fileIndex) {
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_FILE_METADATA",
                            message: `Metadata references missing file index ${index}.`,
                        },
                    });
                }
            }

            for (const metadata of fileMetadata.values()) {
                if (metadata.alt !== undefined && metadata.alt.length > 10000) {
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_ALT_TEXT",
                            message: "Alt text exceeds 10,000 characters.",
                        },
                    });
                }

                if (
                    metadata.sourceUrls.length > 20 ||
                    metadata.sourceUrls.some(
                        (url) =>
                            url.length > 4096 ||
                            (url.trim() !== "" && !isPostyBirbSourceUrl(url.trim())),
                    )
                ) {
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_SOURCE_URL",
                            message: "One or more source URLs are invalid.",
                        },
                    });
                }
            }

            const status = query.status ?? "draft";
            const visibility = query.visibility ?? "private";

            if (status !== "draft" && status !== "published") {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_POST_STATUS",
                        message: "status must be draft or published.",
                    },
                });
            }

            if (visibility !== "public" && visibility !== "unlisted" && visibility !== "private") {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_POST_VISIBILITY",
                        message: "visibility must be public, unlisted, or private.",
                    },
                });
            }

            const files = uploads.map((upload, index) => {
                const metadata = fileMetadata.get(uploadPartIndices[index]!) ?? { sourceUrls: [] };

                return {
                    upload,
                    metadata: {
                        alt: metadata.alt ?? null,
                        sourceUrls: metadata.sourceUrls.map((url) => url.trim()).filter(Boolean),
                    },
                };
            });

            const tags = await findTags(tagNames);
            const sourceUrl = files.flatMap((file) => file.metadata.sourceUrls)[0] ?? null;
            const publishedAt = status === "published" ? new Date() : null;

            const post = await prisma.$transaction(async (tx) => {
                for (const file of files) {
                    const updated = await tx.upload.updateMany({
                        where: {
                            id: file.upload.id,
                            userId: user.id,
                            postId: null,
                            storageArea: "uploads",
                        },
                        data: {
                            metadataJson: mergePostyBirbUploadMetadata(
                                file.upload.metadataJson,
                                file.metadata,
                            ),
                        },
                    });

                    if (updated.count !== 1) {
                        throw new UploadAlreadyAttachedError();
                    }
                }

                const created = await tx.post.create({
                    data: {
                        title,
                        contentType: "image",
                        textContent: null,
                        description: description || null,
                        caption: null,
                        sourceUrl,
                        originalCreator: null,
                        originalCreatedAt: null,
                        allowDownload: true,
                        status,
                        visibility,
                        publishedAt,
                        scheduledAt: null,
                        hiddenAt: null,
                        isNSFW: rating !== "GENERAL",
                        contentWarningType: null,
                        contentWarning: null,
                        permalinkPattern: "user",
                        permalinkIdType: "internalId",
                        customPostId: null,
                        userId: user.id,
                        categoryId: null,
                        tags: tags.length
                            ? {
                                  create: tags.map((tag) => ({
                                      tagId: tag.id,
                                  })),
                              }
                            : undefined,
                        uploads: {
                            connect: files.map(({ upload }) => ({
                                id: upload.id,
                            })),
                        },
                    },
                    include: postInclude,
                });

                return tx.post.update({
                    where: { id: created.id },
                    data: {
                        permalinkKey: permalinkBase(created, "internalId"),
                    },
                    include: postInclude,
                });
            });

            preserveCreatedUploads = true;

            const view = postView(post);

            return reply.code(200).send(
                ok({
                    id: post.id,
                    url: view.permalink,
                    status: post.status,
                    visibility: post.visibility,
                    uploads: view.uploads,
                }),
            );
        } catch (error) {
            if (error instanceof UploadAlreadyAttachedError) {
                return reply.code(409).send({
                    error: {
                        code: "UPLOAD_IN_USE",
                        message: "One or more images have already been attached to another post.",
                    },
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: {
                    code: processingStage === "post" ? "POST_CREATION_FAILED" : "UPLOAD_FAILED",
                    message:
                        processingStage === "post"
                            ? "Failed to create the post from the uploaded images."
                            : "Upload processing failed.",
                },
            });
        } finally {
            if (createPost && !preserveCreatedUploads) {
                await cleanupCreatedUploads();
            }
        }
    };

    fastify.post(
        "/v1/uploads",
        {
            schema: openapi({
                summary: "Upload image",
                description:
                    "Uploads one or more images using multipart/form-data. Supported types are JPG/JPEG, PNG, GIF, WebP, BMP, and AVIF. Extension, MIME type, file signature, and configured size are validated. Set multiple=true to upload up to 20 files.",
            }),
        },
        (request, reply) => handleUpload(request, reply),
    );

    fastify.post(
        "/v1/posts/postybirb",
        {
            schema: openapi({
                tags: "Posts",
                summary: "Create image post from PostyBirb",
                description:
                    "Accepts PostyBirb Custom Website multipart submissions, uploads the images, and creates one image post for the submitted batch.",
            }),
        },
        (request, reply) => handleUpload(request, reply, true),
    );

    fastify.get(
        "/v1/uploads/:uploadId",
        {
            schema: openapi({
                summary: "Get upload metadata",
                description:
                    "Returns upload metadata for an upload owned by the authenticated user.",
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;

            const { uploadId } = request.params as { uploadId: string };
            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
            });

            if (!upload) {
                return reply.code(404).send({
                    error: {
                        code: "UPLOAD_NOT_FOUND",
                        message: "Upload not found.",
                    },
                });
            }

            if (upload.userId !== user.id) {
                return reply.code(403).send({
                    error: {
                        code: "FORBIDDEN",
                        message: "You do not own this upload.",
                    },
                });
            }

            return ok(uploadView(upload));
        },
    );

    fastify.get("/uploads/*", async (request, reply) => {
        const rawPath = String((request.params as Record<string, unknown>)["*"] ?? "").replaceAll(
            "\\",
            "/",
        );

        if (!rawPath || rawPath.includes("..")) {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image not found.",
                },
            });
        }

        const upload = await prisma.upload.findFirst({
            where: {
                filename: rawPath,
                storageArea: "uploads",
            },
            select: {
                filename: true,
                mimeType: true,
                contentHash: true,
                size: true,
                user: {
                    select: {
                        allowSearchEngineIndex: true,
                        allowAiCrawler: true,
                        allowImageCrawler: true,
                        allowCustomCrawler: true,
                    },
                },
            },
        });

        if (!upload) {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image not found.",
                },
            });
        }

        if (!resolveCrawlerPolicy(upload.user).image) {
            reply.header("X-Robots-Tag", "noindex");
        }

        const source = resolveUploadStoragePath(avatarDir, upload.filename);

        if (!source) {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image not found.",
                },
            });
        }

        try {
            const etag = upload.contentHash ? `"${upload.contentHash}"` : undefined;

            reply
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Length", String(upload.size));

            if (etag) {
                reply.header("ETag", etag);

                if (request.headers["if-none-match"] === etag) {
                    return reply.code(304).send();
                }
            }

            reply.type(upload.mimeType);
            return reply.send(createReadStream(source));
        } catch {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image file not found.",
                },
            });
        }
    });

    fastify.get("/v1/avatars/*", async (request, reply) => {
        const rawPath = String((request.params as Record<string, unknown>)["*"] ?? "").replaceAll(
            "\\",
            "/",
        );

        if (!rawPath || rawPath.includes("..")) {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image not found.",
                },
            });
        }

        const upload = await prisma.upload.findFirst({
            where: {
                filename: rawPath,
                storageArea: "avatars",
            },
            select: {
                filename: true,
                mimeType: true,
                contentHash: true,
                size: true,
            },
        });

        if (!upload) {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image not found.",
                },
            });
        }

        const source = resolveUploadStoragePath(avatarDir, upload.filename);

        if (!source) {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image not found.",
                },
            });
        }

        const etag = upload.contentHash ? `"${upload.contentHash}"` : undefined;

        reply
            .header("Cache-Control", "public, max-age=31536000, immutable")
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Length", String(upload.size));

        if (etag) {
            reply.header("ETag", etag);

            if (request.headers["if-none-match"] === etag) {
                return reply.code(304).send();
            }
        }

        try {
            await import("node:fs/promises").then(({ access }) => access(source));
        } catch {
            return reply.code(404).send({
                error: {
                    code: "IMAGE_NOT_FOUND",
                    message: "Image file not found.",
                },
            });
        }

        reply.type(upload.mimeType);
        return reply.send(createReadStream(source));
    });

    fastify.delete(
        "/v1/uploads/:uploadId",
        {
            schema: openapi({
                summary: "Delete upload",
                description:
                    "Deletes an unused upload owned by the authenticated user. Attached uploads return 409 UPLOAD_IN_USE. Returns 204 on success.",
                responseExamples: {
                    "409": {
                        error: {
                            code: "UPLOAD_IN_USE",
                            message: "Upload is already attached to a post.",
                        },
                    },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;

            const { uploadId } = request.params as { uploadId: string };
            const upload = await prisma.upload.findUnique({
                where: { id: uploadId },
            });

            if (!upload) {
                return reply.code(404).send({
                    error: {
                        code: "UPLOAD_NOT_FOUND",
                        message: "Upload not found.",
                    },
                });
            }

            if (upload.userId !== user.id) {
                return reply.code(403).send({
                    error: {
                        code: "FORBIDDEN",
                        message: "You do not own this upload.",
                    },
                });
            }

            if (upload.postId) {
                return reply.code(409).send({
                    error: {
                        code: "UPLOAD_IN_USE",
                        message: "Upload is attached to a post.",
                    },
                });
            }

            await prisma.upload.delete({
                where: { id: uploadId },
            });

            const stillReferenced = await prisma.upload.count({
                where: {
                    filename: upload.filename,
                    storageArea: upload.storageArea,
                },
            });

            if (!stillReferenced) {
                const directory = upload.storageArea === "avatars" ? avatarDir : uploadDir;

                await unlink(path.join(directory, upload.filename)).catch(() => undefined);
            }

            return reply.code(204).send();
        },
    );
};
