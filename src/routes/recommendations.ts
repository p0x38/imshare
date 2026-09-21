import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, parsePagination, requireUser } from "../lib/api.js";
import {
    applyRecommendationExploration,
    jitterRecommendationScore,
    scoreRecommendation,
    scorePersonalizedRecommendation,
    scoreTrending,
} from "../lib/recommendation-scorer.js";
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

        const candidatePool = Math.min(Math.max(p.limit * 20, 120), 500);
        const candidates = await prisma.post.findMany({
            where: publicPostWhere,
            take: candidatePool,
            include: {
                ...postInclude,
                _count: { select: { views: true, reactions: true, comments: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        let ranked = candidates.map((post) => ({
            post,
            score: 0,
        }));

        if (session?.user.id) {
            const [views, likes, preferences, ownPosts, reactionGroups] = await Promise.all([
                prisma.postView.findMany({
                    where: { userId: session.user.id },
                    orderBy: { viewedAt: "desc" },
                    distinct: ["postId"],
                    take: 20,
                    include: { post: { include: postInclude } },
                }),
                prisma.postReaction.findMany({
                    where: { userId: session.user.id, type: "like" },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    include: { post: { include: postInclude } },
                }),
                prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: {
                        interestedTagsJson: true,
                        interestedCategoryIdsJson: true,
                    },
                }),
                prisma.post.findMany({
                    where: { userId: session.user.id },
                    select: { id: true },
                }),
                prisma.postReaction.groupBy({
                    by: ["postId", "type"],
                    where: {
                        postId: { in: candidates.map((post) => post.id) },
                        type: { in: ["like", "favorite"] },
                    },
                    _count: { _all: true },
                }),
            ]);

            const excludedIds = new Set([
                ...ownPosts.map((post) => post.id),
                ...views.map((view) => view.postId),
                ...likes.map((reaction) => reaction.postId),
            ]);
            const viewedPosts = views.map((view) => view.post);
            const likedPosts = likes.map((reaction) => reaction.post);
            let interestedTags: string[] = [];
            let interestedCategoryIds: string[] = [];
            try {
                interestedTags = JSON.parse(preferences?.interestedTagsJson ?? "[]");
                interestedCategoryIds = JSON.parse(preferences?.interestedCategoryIdsJson ?? "[]");
            } catch {
                // Ignore malformed legacy preference data.
            }

            const reactionMetrics = new Map<string, { likes: number; favorites: number }>();
            for (const row of reactionGroups) {
                const metrics = reactionMetrics.get(row.postId) ?? { likes: 0, favorites: 0 };
                if (row.type === "like") metrics.likes = row._count._all;
                else if (row.type === "favorite") metrics.favorites = row._count._all;
                reactionMetrics.set(row.postId, metrics);
            }

            ranked = candidates
                .filter((post) => !excludedIds.has(post.id))
                .map((post) => {
                    const reactions = reactionMetrics.get(post.id) ?? { likes: 0, favorites: 0 };
                    const trending = scoreTrending({
                        views: post._count.views,
                        likes: reactions.likes,
                        favorites: reactions.favorites,
                        comments: post._count.comments,
                        createdAt: post.createdAt,
                    });
                    return {
                        post,
                        score: scorePersonalizedRecommendation(
                            post,
                            {
                                viewedPosts,
                                likedPosts,
                                interestedTags,
                                interestedCategoryIds,
                            },
                            trending,
                        ).total,
                    };
                });
        } else {
            ranked = candidates.map((post) => ({
                post,
                score: scoreTrending({
                    views: post._count.views,
                    likes: post._count.reactions,
                    favorites: 0,
                    comments: post._count.comments,
                    createdAt: post.createdAt,
                }),
            }));
        }

        const rankedWithJitter = ranked.map((item) => ({
            ...item,
            score: jitterRecommendationScore(item.score),
        }));
        const explored = applyRecommendationExploration(rankedWithJitter);
        const items = explored.slice(p.skip, p.skip + p.limit).map(({ post }) => postView(post));
        return collection(items, p.page, p.limit, ranked.length);
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
            select: {
                id: true,
                title: true,
                description: true,
                caption: true,
                contentType: true,
                categoryId: true,
                createdAt: true,
                user: { select: { name: true, handle: true } },
                tags: { include: { tag: { select: { name: true } } } },
                _count: { select: { views: true, reactions: true, comments: true } },
            },
        });
        if (!source)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });

        const candidatePool = Math.min(Math.max(p.limit * 20, 100), 500);
        const candidates = await prisma.post.findMany({
            where: { ...publicPostWhere, id: { not: postId } },
            take: candidatePool,
            include: {
                ...postInclude,
                _count: { select: { views: true, reactions: true, comments: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const ranked = candidates
            .map((post) => ({ post, score: scoreRecommendation(source, post).total }))
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
