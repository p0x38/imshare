import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import {
    collection,
    getSession,
    ok,
    parseOrder,
    parsePagination,
    requireUser,
} from "../lib/api.js";
import { findTags, postInclude, postView } from "./_shared.js";
import { permalinkBase, type PermalinkIdType } from "../lib/post-permalink.js";
import {
    postCategorySchema,
    postCreateSchema,
    postTagSchema,
    postUpdateSchema,
} from "./schemas.js";
import {
    postBatchDeleteBodyJsonSchema,
    postBatchUpdateBodyJsonSchema,
    postBatchUploadBodyJsonSchema,
    postCreateBodyJsonSchema,
    postMergeBodyJsonSchema,
    postUpdateBodyJsonSchema,
} from "./schemas-zod.js";

function publicPostWhere() {
    return {
        status: "published",
        visibility: "public",
        hiddenAt: null,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        user: { isPublic: true, showPosts: true, showProfile: true, isBanned: false },
    } as const;
}

function lifecycleData(body: {
    status?: string;
    visibility?: string;
    scheduledAt?: string | null;
    isNSFW?: boolean;
    contentWarningType?: string | null;
    contentWarning?: string | null;
}) {
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    const status =
        scheduledAt && scheduledAt.getTime() > Date.now() ? "draft" : (body.status ?? "published");
    return {
        status,
        visibility: body.visibility ?? "public",
        scheduledAt,
        publishedAt: status === "published" && !scheduledAt ? new Date() : null,
        isNSFW: body.isNSFW ?? false,
        contentWarningType: body.contentWarningType ?? null,
        contentWarning: body.contentWarning ?? null,
    };
}

function permalinkData(body: {
    permalinkPattern?: string;
    permalinkIdType?: string;
    customPostId?: string | null;
}) {
    const permalinkPattern = body.permalinkPattern ?? "user";
    const permalinkIdType = body.permalinkIdType ?? "internalId";
    if (permalinkPattern !== "user" && permalinkPattern !== "posts")
        throw new Error("Invalid permalink pattern.");
    if (!["normalizedTitle", "internalId", "creationDate", "custom"].includes(permalinkIdType))
        throw new Error("Invalid permalink ID type.");
    const customPostId = body.customPostId?.trim() || null;
    if (permalinkIdType === "custom" && !customPostId)
        throw new Error("A custom post ID is required when using the custom ID type.");
    return { permalinkPattern, permalinkIdType, customPostId };
}

export const postRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/posts", async (request) => {
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const session = await getSession(request);
        const isOwnListing = typeof q.user === "string" && q.user === session?.user.id;
        const where: Record<string, unknown> = isOwnListing ? {} : publicPostWhere();
        if (typeof q.user === "string") where.userId = q.user;
        if (typeof q.category === "string") where.categoryId = q.category;
        if (typeof q.tag === "string") where.tags = { some: { tag: { slug: q.tag } } };
        if (typeof q.search === "string")
            where.OR = [
                { title: { contains: q.search } },
                { description: { contains: q.search } },
                { caption: { contains: q.search } },
            ];
        const [items, total] = await Promise.all([
            prisma.post.findMany({
                where: where as never,
                include: postInclude,
                skip: p.skip,
                take: p.limit,
                orderBy: { createdAt: parseOrder(q.order) },
            }),
            prisma.post.count({ where: where as never }),
        ]);
        return collection(items.map(postView), p.page, p.limit, total);
    });

    fastify.post(
        "/v1/posts",
        { schema: { body: postCreateBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const body = request.body as {
                title: string;
                description?: string;
                caption?: string;
                sourceUrl?: string;
                originalCreator?: string | null;
                originalCreatedAt?: string | null;
                permalinkPattern?: string;
                permalinkIdType?: string;
                customPostId?: string | null;
                allowDownload?: boolean;
                status?: string;
                visibility?: string;
                scheduledAt?: string | null;
                isNSFW?: boolean;
                contentWarningType?: string | null;
                contentWarning?: string | null;
                tags?: string[];
                categoryId?: string | null;
                uploadIds?: string[];
            };
            if (!body.title.trim())
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_POST", message: "title is required." } });
            const uploadIds = [...new Set(body.uploadIds ?? [])];
            if (uploadIds.length > 0) {
                const ownedUploads = await prisma.upload.count({
                    where: { id: { in: uploadIds }, userId: user.id, postId: null },
                });
                if (ownedUploads !== uploadIds.length)
                    return reply.code(403).send({
                        error: {
                            code: "FORBIDDEN",
                            message: "You can only attach your own unused uploads.",
                        },
                    });
            }
            const tags = await findTags(body.tags ?? []);
            const lifecycle = lifecycleData(body);
            let permalink;
            try {
                permalink = permalinkData(body);
            } catch (error) {
                return reply.code(400).send({
                    error: {
                        code: "INVALID_PERMALINK",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Invalid permalink configuration.",
                    },
                });
            }
            const post = await prisma.$transaction(async (tx) => {
                const created = await tx.post.create({
                    data: {
                        title: body.title.trim(),
                        description: body.description,
                        caption: body.caption,
                        sourceUrl: body.sourceUrl,
                        originalCreator: body.originalCreator?.trim() || null,
                        originalCreatedAt: body.originalCreatedAt
                            ? new Date(body.originalCreatedAt)
                            : null,
                        ...permalink,
                        allowDownload: body.allowDownload ?? true,
                        ...lifecycle,
                        categoryId: body.categoryId,
                        userId: user.id,
                        tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
                        uploads: uploadIds.length
                            ? { connect: uploadIds.map((id) => ({ id })) }
                            : undefined,
                    },
                    include: postInclude,
                });

                return tx.post.update({
                    where: { id: created.id },
                    data: {
                        permalinkKey: permalinkBase(
                            created,
                            permalink.permalinkIdType as PermalinkIdType,
                        ),
                    },
                    include: postInclude,
                });
            });
            return reply.code(201).send(ok(postView(post)));
        },
    );

    fastify.post(
        "/v1/posts/batch",
        { schema: { body: postBatchUploadBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;

            const body = request.body as { uploadIds: string[] };
            const uploadIds = [...new Set(body.uploadIds)];
            const uploads = await prisma.upload.findMany({
                where: { id: { in: uploadIds }, userId: user.id },
                orderBy: { createdAt: "asc" },
            });

            if (uploads.length !== uploadIds.length)
                return reply.code(404).send({
                    error: {
                        code: "UPLOAD_NOT_FOUND",
                        message: "One or more uploaded images were not found.",
                    },
                });

            if (uploads.some((upload) => upload.postId))
                return reply.code(409).send({
                    error: {
                        code: "UPLOAD_IN_USE",
                        message: "One or more uploaded images are already attached to a post.",
                    },
                });

            const created = await prisma.$transaction(async (tx) => {
                const posts = [];
                for (const upload of uploads) {
                    const title =
                        upload.originalName?.replace(/\.[^.]+$/, "")?.trim() || "Untitled";
                    const post = await tx.post.create({
                        data: {
                            title,
                            contentType: "image",
                            textContent: null,
                            description: null,
                            caption: null,
                            sourceUrl: null,
                            originalCreator: null,
                            originalCreatedAt: null,
                            allowDownload: true,
                            status: "draft",
                            visibility: "private",
                            publishedAt: null,
                            scheduledAt: null,
                            hiddenAt: null,
                            contentWarning: null,
                            permalinkPattern: "user",
                            permalinkIdType: "internalId",
                            customPostId: null,
                            userId: user.id,
                            categoryId: null,
                            uploads: { connect: [{ id: upload.id }] },
                        },
                        include: postInclude,
                    });
                    posts.push(
                        await tx.post.update({
                            where: { id: post.id },
                            data: { permalinkKey: permalinkBase(post, "internalId") },
                            include: postInclude,
                        }),
                    );
                }
                return posts;
            });

            return reply.code(201).send(ok(created.map(postView)));
        },
    );

    fastify.patch(
        "/v1/posts/batch",
        { schema: { body: postBatchUpdateBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;

            const body = request.body as {
                postIds: string[];
                allowDownload?: boolean;
                status?: string;
                visibility?: string;
                scheduledAt?: string | null;
                contentWarning?: string | null;
                tags?: string[];
                categoryId?: string | null;
            };
            const postIds = [...new Set(body.postIds)];
            const posts = await prisma.post.findMany({
                where: { id: { in: postIds } },
                include: { tags: { select: { tagId: true } } },
            });

            if (posts.length !== postIds.length)
                return reply.code(404).send({
                    error: { code: "POST_NOT_FOUND", message: "One or more posts were not found." },
                });

            if (posts.some((post) => post.userId !== user.id))
                return reply.code(403).send({
                    error: {
                        code: "FORBIDDEN",
                        message: "You can only edit your own posts.",
                    },
                });

            const tags = body.tags !== undefined ? await findTags(body.tags) : undefined;

            await prisma.$transaction(async (tx) => {
                for (const post of posts) {
                    const lifecycle =
                        body.status !== undefined ||
                        body.visibility !== undefined ||
                        body.scheduledAt !== undefined ||
                        body.isNSFW !== undefined ||
                        body.contentWarningType !== undefined ||
                        body.contentWarning !== undefined
                            ? lifecycleData({
                                  status: body.status ?? post.status,
                                  visibility: body.visibility ?? post.visibility,
                                  scheduledAt:
                                      body.scheduledAt !== undefined
                                          ? body.scheduledAt
                                          : (post.scheduledAt?.toISOString() ?? null),
                                  isNSFW: body.isNSFW ?? post.isNSFW,
                                  contentWarningType:
                                      body.contentWarningType !== undefined
                                          ? body.contentWarningType
                                          : post.contentWarningType,
                                  contentWarning:
                                      body.contentWarning !== undefined
                                          ? body.contentWarning
                                          : post.contentWarning,
                              })
                            : {};

                    await tx.postRevision.create({
                        data: {
                            postId: post.id,
                            title: post.title,
                            description: post.description,
                            caption: post.caption,
                            sourceUrl: post.sourceUrl,
                            allowDownload: post.allowDownload,
                            status: post.status,
                            visibility: post.visibility,
                            scheduledAt: post.scheduledAt,
                            publishedAt: post.publishedAt,
                            categoryId: post.categoryId,
                            isNSFW: post.isNSFW,
                            contentWarningType: post.contentWarningType,
                            tagsJson: JSON.stringify(post.tags.map((tag) => tag.tagId)),
                            contentWarning: post.contentWarning,
                            createdById: user.id,
                        },
                    });
                    await tx.post.update({
                        where: { id: post.id },
                        data: {
                            allowDownload: body.allowDownload,
                            categoryId: body.categoryId,
                            ...(body.tags !== undefined
                                ? {
                                      tags: {
                                          deleteMany: {},
                                          create: tags!.map((tag) => ({ tagId: tag.id })),
                                      },
                                  }
                                : {}),
                            ...lifecycle,
                        },
                    });
                }
            });

            return ok({
                updatedCount: posts.length,
                postIds,
            });
        },
    );

    fastify.delete(
        "/v1/posts/batch",
        { schema: { body: postBatchDeleteBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;

            const body = request.body as { postIds: string[] };
            const postIds = [...new Set(body.postIds)];
            const posts = await prisma.post.findMany({
                where: { id: { in: postIds } },
                select: { id: true, userId: true },
            });

            if (posts.length !== postIds.length)
                return reply.code(404).send({
                    error: { code: "POST_NOT_FOUND", message: "One or more posts were not found." },
                });

            if (posts.some((post) => post.userId !== user.id))
                return reply.code(403).send({
                    error: { code: "FORBIDDEN", message: "You can only delete your own posts." },
                });

            const result = await prisma.post.deleteMany({ where: { id: { in: postIds } } });
            return ok({ deletedCount: result.count });
        },
    );

    fastify.post(
        "/v1/posts/merge",
        { schema: { body: postMergeBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;

            const body = request.body as { postIds: string[] };
            const postIds = [...new Set(body.postIds)];

            if (postIds.length < 2)
                return reply.code(400).send({
                    error: { code: "INVALID_MERGE", message: "At least two posts are required." },
                });

            const posts = await prisma.post.findMany({
                where: { id: { in: postIds } },
                include: {
                    tags: { select: { tagId: true } },
                    uploads: { select: { id: true } },
                },
                orderBy: { createdAt: "asc" },
            });

            if (posts.length !== postIds.length)
                return reply.code(404).send({
                    error: { code: "POST_NOT_FOUND", message: "One or more posts were not found." },
                });

            if (posts.some((post) => post.userId !== user.id))
                return reply.code(403).send({
                    error: { code: "FORBIDDEN", message: "You can only combine your own posts." },
                });

            if (posts.some((post) => post.status !== "draft"))
                return reply.code(400).send({
                    error: { code: "INVALID_MERGE", message: "Only draft posts can be combined." },
                });

            if (posts.some((post) => post.contentType !== "image"))
                return reply.code(400).send({
                    error: { code: "INVALID_MERGE", message: "Only image posts can be combined." },
                });

            const [keeper, ...merged] = posts;
            if (!keeper)
                return reply.code(400).send({
                    error: { code: "INVALID_MERGE", message: "At least one post is required to merge." },
                });

            const uploadIds = posts.flatMap((post) => post.uploads.map((upload) => upload.id));
            const tagIds = [...new Set(posts.flatMap((post) => post.tags.map((tag) => tag.tagId)))];

            const result = await prisma.$transaction(async (tx) => {
                const updated = await tx.post.update({
                    where: { id: keeper.id },
                    data: {
                        uploads: {
                            connect: uploadIds
                                .filter((id) => !keeper.uploads.some((upload) => upload.id === id))
                                .map((id) => ({ id })),
                        },
                        tags: {
                            deleteMany: {},
                            create: tagIds.map((tagId) => ({ tagId })),
                        },
                    },
                    include: postInclude,
                });

                await tx.post.deleteMany({
                    where: { id: { in: merged.map((post) => post.id) } },
                });

                return updated;
            });

            return ok(postView(result));
        },
    );


    fastify.post("/v1/posts/:postId/split", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;

        const { postId } = request.params as { postId: string };
        const existing = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                tags: { select: { tagId: true } },
                uploads: { orderBy: { createdAt: "asc" } },
            },
        });

        if (!existing)
            return reply.code(404).send({
                error: { code: "POST_NOT_FOUND", message: "Post not found." },
            });

        if (existing.userId !== user.id)
            return reply.code(403).send({
                error: { code: "FORBIDDEN", message: "You do not own this post." },
            });

        if (existing.contentType !== "image" || existing.uploads.length < 2)
            return reply.code(400).send({
                error: {
                    code: "INVALID_SPLIT",
                    message: "Only multi-image posts can be split.",
                },
            });

        const [firstUpload, ...additionalUploads] = existing.uploads;
        if (!firstUpload)
            return reply.code(400).send({
                error: {
                    code: "INVALID_SPLIT",
                    message: "The post does not contain an image to keep.",
                },
            });

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.post.update({
                where: { id: existing.id },
                data: {
                    uploads: {
                        set: [{ id: firstUpload.id }],
                    },
                },
                include: postInclude,
            });

            const createdPosts = [];
            for (const upload of additionalUploads) {
                const created = await tx.post.create({
                    data: {
                        title: existing.title,
                        contentType: "image",
                        textContent: null,
                        description: existing.description,
                        caption: existing.caption,
                        sourceUrl: existing.sourceUrl,
                        originalCreator: existing.originalCreator,
                        originalCreatedAt: existing.originalCreatedAt,
                        allowDownload: existing.allowDownload,
                        status: existing.status,
                        visibility: existing.visibility,
                        publishedAt: existing.publishedAt,
                        scheduledAt: existing.scheduledAt,
                        hiddenAt: existing.hiddenAt,
                        contentWarning: existing.contentWarning,
                        permalinkPattern: existing.permalinkPattern,
                        permalinkIdType: "internalId",
                        customPostId: null,
                        userId: existing.userId,
                        categoryId: existing.categoryId,
                        tags: {
                            create: existing.tags.map(({ tagId }) => ({ tagId })),
                        },
                        uploads: {
                            connect: [{ id: upload.id }],
                        },
                    },
                    include: postInclude,
                });

                createdPosts.push(
                    await tx.post.update({
                        where: { id: created.id },
                        data: {
                            permalinkKey: permalinkBase(created, "internalId"),
                        },
                        include: postInclude,
                    }),
                );
            }

            return [updated, ...createdPosts];
        });

        return ok(result.map(postView));
    });

    fastify.get("/v1/posts/:postId", async (request, reply) => {
        const { postId } = request.params as { postId: string };
        const session = await getSession(request);
        const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        const owner = post.userId === session?.user.id;
        const publicVisible =
            post.status === "published" &&
            post.visibility === "public" &&
            !post.hiddenAt &&
            (!post.scheduledAt || post.scheduledAt <= new Date());
        const unlistedVisible =
            post.status === "published" &&
            post.visibility === "unlisted" &&
            !post.hiddenAt &&
            (!post.scheduledAt || post.scheduledAt <= new Date());
        if (!owner && !publicVisible && !unlistedVisible)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        await prisma.postView.create({
            data: { postId, userId: session?.user.id ?? null },
        });
        post._count.views += 1;
        return ok(postView(post));
    });

    fastify.patch(
        "/v1/posts/:postId",
        { schema: { body: postUpdateBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { postId } = request.params as { postId: string };
            const existing = await prisma.post.findUnique({
                where: { id: postId },
                include: { tags: { select: { tagId: true } } },
            });
            if (!existing)
                return reply
                    .code(404)
                    .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
            if (existing.userId !== user.id)
                return reply
                    .code(403)
                    .send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
            const body = request.body as {
                title?: string;
                description?: string | null;
                caption?: string | null;
                sourceUrl?: string | null;
                originalCreator?: string | null;
                originalCreatedAt?: string | null;
                permalinkPattern?: string;
                permalinkIdType?: string;
                customPostId?: string | null;
                allowDownload?: boolean;
                status?: string;
                visibility?: string;
                scheduledAt?: string | null;
                contentWarning?: string | null;
                categoryId?: string | null;
                tags?: string[];
            };
            if (body.title !== undefined && !body.title.trim())
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_POST", message: "title cannot be empty." } });
            const tags = body.tags ? await findTags(body.tags) : [];
            const lifecycle =
                body.status !== undefined ||
                body.visibility !== undefined ||
                body.scheduledAt !== undefined ||
                body.contentWarning !== undefined
                    ? lifecycleData({
                          status: body.status ?? existing.status,
                          visibility: body.visibility ?? existing.visibility,
                          scheduledAt:
                              body.scheduledAt !== undefined
                                  ? body.scheduledAt
                                  : (existing.scheduledAt?.toISOString() ?? null),
                          contentWarning:
                              body.contentWarning !== undefined
                                  ? body.contentWarning
                                  : existing.contentWarning,
                      })
                    : {};
            let permalink = {};
            if (
                body.permalinkPattern !== undefined ||
                body.permalinkIdType !== undefined ||
                body.customPostId !== undefined
            ) {
                try {
                    permalink = permalinkData({
                        permalinkPattern: body.permalinkPattern ?? existing.permalinkPattern,
                        permalinkIdType: body.permalinkIdType ?? existing.permalinkIdType,
                        customPostId:
                            body.customPostId !== undefined
                                ? body.customPostId
                                : existing.customPostId,
                    });
                } catch (error) {
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_PERMALINK",
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Invalid permalink configuration.",
                        },
                    });
                }
            }
            const post = await prisma.$transaction(async (tx) => {
                await tx.postRevision.create({
                    data: {
                        postId,
                        title: existing.title,
                        description: existing.description,
                        caption: existing.caption,
                        sourceUrl: existing.sourceUrl,
                        allowDownload: existing.allowDownload,
                        categoryId: existing.categoryId,
                        tagsJson: JSON.stringify(existing.tags.map((tag) => tag.tagId)),
                        contentWarning: existing.contentWarning,
                        createdById: user.id,
                    },
                });
                if (body.tags) await tx.postTag.deleteMany({ where: { postId } });
                return tx.post.update({
                    where: { id: postId },
                    data: {
                        title: body.title?.trim(),
                        description: body.description,
                        caption: body.caption,
                        sourceUrl: body.sourceUrl,
                        originalCreator:
                            body.originalCreator === undefined
                                ? undefined
                                : body.originalCreator?.trim() || null,
                        originalCreatedAt:
                            body.originalCreatedAt === undefined
                                ? undefined
                                : body.originalCreatedAt
                                  ? new Date(body.originalCreatedAt)
                                  : null,
                        allowDownload: body.allowDownload,
                        categoryId: body.categoryId,
                        ...permalink,
                        ...(body.tags
                            ? { tags: { create: tags.map((tag) => ({ tagId: tag.id })) } }
                            : {}),
                        ...lifecycle,
                    },
                    include: postInclude,
                });
            });
            return ok(postView(post));
        },
    );

    fastify.delete("/v1/posts/:postId", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true },
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id)
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
        await prisma.post.delete({ where: { id: postId } });
        return reply.code(204).send();
    });

    fastify.get("/v1/posts/:postId/tags", async (request, reply) => {
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, visibility: true, status: true, hiddenAt: true },
        });
        if (!post || post.status !== "published" || post.visibility === "private" || post.hiddenAt)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        const tags = await prisma.postTag.findMany({
            where: { postId },
            include: { tag: true },
            orderBy: { tag: { name: "asc" } },
        });
        return ok(tags.map(({ tag }) => tag));
    });

    fastify.post("/v1/posts/:postId/tags", { schema: postTagSchema }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const body = request.body as { tagId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true },
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id)
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
        const tag = await prisma.tag.findUnique({ where: { id: body.tagId } });
        if (!tag)
            return reply
                .code(404)
                .send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } });
        await prisma.postTag.upsert({
            where: { postId_tagId: { postId, tagId: tag.id } },
            update: {},
            create: { postId, tagId: tag.id },
        });
        return ok(tag);
    });

    fastify.delete("/v1/posts/:postId/tags/:tagId", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId, tagId } = request.params as { postId: string; tagId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true },
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id)
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
        await prisma.postTag.deleteMany({ where: { postId, tagId } });
        return reply.code(204).send();
    });

    fastify.get("/v1/posts/:postId/category", async (request, reply) => {
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, visibility: true, status: true, hiddenAt: true, category: true },
        });
        if (!post || post.status !== "published" || post.visibility === "private" || post.hiddenAt)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        return ok(post.category);
    });

    fastify.put(
        "/v1/posts/:postId/category",
        { schema: postCategorySchema },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { postId } = request.params as { postId: string };
            const body = request.body as { categoryId: string | null };
            const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { userId: true },
            });
            if (!post)
                return reply
                    .code(404)
                    .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
            if (post.userId !== user.id)
                return reply
                    .code(403)
                    .send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
            if (body.categoryId) {
                const category = await prisma.category.findUnique({
                    where: { id: body.categoryId },
                });
                if (!category)
                    return reply.code(404).send({
                        error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." },
                    });
            }
            const updated = await prisma.post.update({
                where: { id: postId },
                data: { categoryId: body.categoryId },
                include: postInclude,
            });
            return ok(postView(updated));
        },
    );

    fastify.delete("/v1/posts/:postId/category", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true },
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id)
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
        await prisma.post.update({ where: { id: postId }, data: { categoryId: null } });
        return reply.code(204).send();
    });
};
