import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, parsePagination, requireUser } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

const publicPostWhere = {
    status: "published",
    visibility: "public",
    hiddenAt: null,
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    user: { isPublic: true, showPosts: true, showProfile: true, isBanned: false },
};

export const recommendationRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/recommendations", async (request) => {
        const session = await getSession(request);
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        let preferredTagIds: string[] = [];
        let preferredCategoryIds: string[] = [];
        let excludedIds: string[] = [];
        if (session?.user.id) {
            const [reactions, ownPosts] = await Promise.all([
                prisma.postReaction.findMany({
                    where: { userId: session.user.id },
                    select: {
                        post: {
                            select: {
                                id: true,
                                categoryId: true,
                                tags: { select: { tagId: true } },
                            },
                        },
                    },
                }),
                prisma.post.findMany({ where: { userId: session.user.id }, select: { id: true } }),
            ]);
            excludedIds = ownPosts.map((post) => post.id);
            preferredCategoryIds = [
                ...new Set(
                    reactions
                        .map((row) => row.post.categoryId)
                        .filter((id): id is string => Boolean(id)),
                ),
            ];
            preferredTagIds = [
                ...new Set(reactions.flatMap((row) => row.post.tags.map((tag) => tag.tagId))),
            ];
        }
        const where = {
            ...publicPostWhere,
            id: { notIn: excludedIds },
            ...(preferredCategoryIds.length || preferredTagIds.length
                ? {
                      AND: [
                          {
                              OR: [
                                  ...(preferredCategoryIds.length
                                      ? [{ categoryId: { in: preferredCategoryIds } }]
                                      : []),
                                  ...(preferredTagIds.length
                                      ? [{ tags: { some: { tagId: { in: preferredTagIds } } } }]
                                      : []),
                              ],
                          },
                      ],
                  }
                : {}),
        };
        const [items, total] = await Promise.all([
            prisma.post.findMany({
                where,
                include: postInclude,
                skip: p.skip,
                take: p.limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.post.count({ where }),
        ]);
        return collection(items.map(postView), p.page, p.limit, total);
    });

    fastify.post("/v1/posts/:postId/view", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findFirst({
            where: { id: postId, ...publicPostWhere },
            select: { id: true },
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        await prisma.postView.create({ data: { postId, userId: user.id } });
        return { data: { recorded: true } };
    });

    fastify.get("/v1/discovery/recently-viewed", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const views = await prisma.postView.findMany({
            where: { userId: user.id },
            distinct: ["postId"],
            orderBy: { viewedAt: "desc" },
            skip: p.skip,
            take: p.limit,
            include: { post: { include: postInclude } },
        });
        const items = views.map((view) => postView(view.post));
        return collection(items, p.page, p.limit, items.length);
    });

    fastify.get("/v1/posts/:postId/related", async (request, reply) => {
        const { postId } = request.params as { postId: string };
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const source = await prisma.post.findFirst({
            where: { id: postId, ...publicPostWhere },
            select: { id: true, categoryId: true, tags: { select: { tagId: true } } },
        });
        if (!source)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        const tagIds = source.tags.map((tag) => tag.tagId);
        const where = {
            ...publicPostWhere,
            id: { not: postId },
            OR: [
                ...(source.categoryId ? [{ categoryId: source.categoryId }] : []),
                ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
            ],
        };
        const candidates = await prisma.post.findMany({
            where,
            take: Math.min(Math.max(p.limit * 4, 20), 100),
            include: postInclude,
            orderBy: { createdAt: "desc" },
        });
        const ranked = candidates
            .map((post) => {
                const sharedTags = post.tags.filter((tag) => tagIds.includes(tag.tagId)).length;
                const categoryMatch =
                    source.categoryId && post.categoryId === source.categoryId ? 2 : 0;
                return { post, score: sharedTags * 3 + categoryMatch };
            })
            .sort(
                (a, b) =>
                    b.score - a.score || b.post.createdAt.getTime() - a.post.createdAt.getTime(),
            );
        const items = ranked.slice(p.skip, p.skip + p.limit).map(({ post }) => postView(post));
        return collection(items, p.page, p.limit, ranked.length);
    });

    fastify.get("/v1/discovery/trending", async (request) => {
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const candidates = await prisma.post.findMany({
            where: publicPostWhere,
            take: 200,
            include: {
                ...postInclude,
                _count: { select: { reactions: true, comments: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        const now = Date.now();
        const ranked = candidates
            .map((post) => {
                const ageHours = Math.max((now - post.createdAt.getTime()) / 3_600_000, 1);
                const engagement = post._count.reactions * 3 + post._count.comments * 2;
                return { post, score: engagement / Math.pow(ageHours, 0.65) };
            })
            .sort((a, b) => b.score - a.score);
        const items = ranked.slice(p.skip, p.skip + p.limit).map(({ post }) => postView(post));
        return collection(items, p.page, p.limit, ranked.length);
    });
};
