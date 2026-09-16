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
import { postCreateBodyJsonSchema, postUpdateBodyJsonSchema } from "./schemas-zod.js";

function publicTextWhere() {
    return {
        contentType: "text",
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
        contentWarning: body.contentWarning ?? null,
    };
}

export const textRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/texts", async (request) => {
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const session = await getSession(request);
        const isOwnListing = typeof q.user === "string" && q.user === session?.user.id;
        const where: Record<string, unknown> = isOwnListing
            ? { contentType: "text" }
            : publicTextWhere();
        if (typeof q.user === "string") where.userId = q.user;
        if (typeof q.category === "string") where.categoryId = q.category;
        if (typeof q.tag === "string") where.tags = { some: { tag: { slug: q.tag } } };
        if (typeof q.search === "string" && q.search.trim())
            where.OR = [
                { title: { contains: q.search.trim() } },
                { textContent: { contains: q.search.trim() } },
                { description: { contains: q.search.trim() } },
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
        "/v1/texts",
        { schema: { body: postCreateBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const body = request.body as {
                title: string;
                contentType?: string;
                textContent?: string | null;
                description?: string;
                caption?: string;
                sourceUrl?: string;
                originalCreator?: string | null;
                originalCreatedAt?: string | null;
                allowDownload?: boolean;
                status?: string;
                visibility?: string;
                scheduledAt?: string | null;
                contentWarning?: string | null;
                tags?: string[];
                categoryId?: string | null;
                permalinkPattern?: "user" | "posts";
                permalinkIdType?: "normalizedTitle" | "internalId" | "creationDate" | "custom";
                customPostId?: string | null;
            };
            const textContent = body.textContent?.trim();
            if (!body.title.trim())
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_TEXT", message: "title is required." } });
            if (!textContent)
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_TEXT", message: "textContent is required." } });
            const tags = await findTags(body.tags ?? []);
            const lifecycle = lifecycleData(body);
            const post = await prisma.post.create({
                data: {
                    title: body.title.trim(),
                    contentType: "text",
                    textContent,
                    description: body.description,
                    caption: body.caption,
                    sourceUrl: body.sourceUrl,
                    originalCreator: body.originalCreator?.trim() || null,
                    originalCreatedAt: body.originalCreatedAt
                        ? new Date(body.originalCreatedAt)
                        : null,
                    allowDownload: false,
                    ...lifecycle,
                    categoryId: body.categoryId,
                    userId: user.id,
                    permalinkPattern: body.permalinkPattern ?? "user",
                    permalinkIdType: body.permalinkIdType ?? "internalId",
                    customPostId: body.customPostId?.trim() || null,
                    tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
                },
                include: postInclude,
            });
            return reply.code(201).send(ok(postView(post)));
        },
    );

    fastify.get("/v1/texts/:textId", async (request, reply) => {
        const { textId } = request.params as { textId: string };
        const session = await getSession(request);
        const post = await prisma.post.findFirst({
            where: { id: textId, contentType: "text" },
            include: postInclude,
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "TEXT_NOT_FOUND", message: "Text not found." } });
        const owner = post.userId === session?.user.id;
        const visible =
            post.status === "published" &&
            ["public", "unlisted"].includes(post.visibility) &&
            !post.hiddenAt &&
            (!post.scheduledAt || post.scheduledAt <= new Date());
        if (!owner && !visible)
            return reply
                .code(404)
                .send({ error: { code: "TEXT_NOT_FOUND", message: "Text not found." } });
        await prisma.postView.create({
            data: { postId: post.id, userId: session?.user.id ?? null },
        });
        post._count.views += 1;
        return ok(postView(post));
    });

    fastify.patch(
        "/v1/texts/:textId",
        { schema: { body: postUpdateBodyJsonSchema } },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { textId } = request.params as { textId: string };
            const existing = await prisma.post.findFirst({
                where: { id: textId, contentType: "text" },
                include: { tags: { select: { tagId: true } } },
            });
            if (!existing)
                return reply
                    .code(404)
                    .send({ error: { code: "TEXT_NOT_FOUND", message: "Text not found." } });
            if (existing.userId !== user.id)
                return reply
                    .code(403)
                    .send({ error: { code: "FORBIDDEN", message: "You do not own this text." } });
            const body = request.body as {
                title?: string;
                contentType?: string;
                textContent?: string | null;
                description?: string | null;
                caption?: string | null;
                sourceUrl?: string | null;
                allowDownload?: boolean;
                status?: string;
                visibility?: string;
                scheduledAt?: string | null;
                contentWarning?: string | null;
                categoryId?: string | null;
                tags?: string[];
                permalinkPattern?: "user" | "posts";
                permalinkIdType?: "normalizedTitle" | "internalId" | "creationDate" | "custom";
                customPostId?: string | null;
            };
            if (body.title !== undefined && !body.title.trim())
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_TEXT", message: "title cannot be empty." } });
            if (body.textContent !== undefined && !body.textContent?.trim())
                return reply
                    .code(400)
                    .send({
                        error: { code: "INVALID_TEXT", message: "textContent cannot be empty." },
                    });
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
            const post = await prisma.$transaction(async (tx) => {
                await tx.postRevision.create({
                    data: {
                        postId: textId,
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
                if (body.tags) await tx.postTag.deleteMany({ where: { postId: textId } });
                return tx.post.update({
                    where: { id: textId },
                    data: {
                        title: body.title?.trim(),
                        textContent:
                            body.textContent === undefined ? undefined : body.textContent?.trim(),
                        description: body.description,
                        caption: body.caption,
                        sourceUrl: body.sourceUrl,
                        allowDownload: false,
                        categoryId: body.categoryId,
                        permalinkPattern: body.permalinkPattern,
                        permalinkIdType: body.permalinkIdType,
                        customPostId:
                            body.customPostId === undefined
                                ? undefined
                                : body.customPostId?.trim() || null,
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
};
