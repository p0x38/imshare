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

function normalizeText(value: string | null | undefined, maxLength = 1200): string {
    return (value ?? "")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .slice(0, maxLength);
}

function tokens(value: string | null | undefined): Set<string> {
    return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length >= 2));
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (a.length > b.length) [a, b] = [b, a];
    let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        const current = new Array<number>(a.length + 1);
        current[0] = j;
        for (let i = 1; i <= a.length; i++) {
            const insertion = current[i - 1]! + 1;
            const deletion = previous[i]! + 1;
            const substitution = previous[i - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[i] = Math.min(insertion, deletion, substitution);
        }
        previous = current;
    }
    return previous[a.length]!;
}

function stringSimilarity(a: string | null | undefined, b: string | null | undefined): number {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (!left && !right) return 1;
    if (!left || !right) return 0;
    const longest = Math.max(left.length, right.length);
    return 1 - levenshtein(left, right) / longest;
}

function tokenSimilarity(a: string | null | undefined, b: string | null | undefined): number {
    const left = tokens(a);
    const right = tokens(b);
    if (!left.size && !right.size) return 1;
    if (!left.size || !right.size) return 0;
    let intersection = 0;
    for (const token of left) if (right.has(token)) intersection++;
    return intersection / new Set([...left, ...right]).size;
}

function tagSimilarity(
    left: Array<{ tag: { name: string } }>,
    right: Array<{ tag: { name: string } }>,
): number {
    const a = new Set(left.map(({ tag }) => normalizeText(tag.name, 200)).filter(Boolean));
    const b = new Set(right.map(({ tag }) => normalizeText(tag.name, 200)).filter(Boolean));
    if (!a.size && !b.size) return 1;
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const value of a) if (b.has(value)) intersection++;
    return intersection / new Set([...a, ...b]).size;
}

function recencyScore(createdAt: Date): number {
    const ageDays = Math.max((Date.now() - createdAt.getTime()) / 86_400_000, 0);
    return Math.exp(-ageDays / 45);
}

function engagementScore(post: {
    _count: { views: number; reactions: number; comments: number };
}): number {
    const views = Math.log1p(post._count.views);
    const reactions = Math.log1p(post._count.reactions);
    const comments = Math.log1p(post._count.comments);
    return Math.min((views * 0.45 + reactions * 1.5 + comments * 1.25) / 12, 1);
}

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
            select: {
                id: true,
                title: true,
                description: true,
                caption: true,
                contentType: true,
                categoryId: true,
                user: { select: { name: true, handle: true } },
                tags: { include: { tag: { select: { name: true } } } },
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
            .map((post) => {
                const titleEdit = stringSimilarity(source.title, post.title);
                const titleTokens = tokenSimilarity(source.title, post.title);
                const descriptionEdit = stringSimilarity(source.description, post.description);
                const descriptionTokens = tokenSimilarity(source.description, post.description);
                const captionSimilarity = tokenSimilarity(source.caption, post.caption);
                const authorValue = [
                    source.user.name,
                    source.user.handle,
                ].filter(Boolean).join(" ");
                const candidateAuthorValue = [
                    post.user.name,
                    post.user.handle,
                ].filter(Boolean).join(" ");
                const authorEdit = stringSimilarity(authorValue, candidateAuthorValue);
                const authorExact =
                    source.user.handle && post.user.handle
                        ? normalizeText(source.user.handle, 200) === normalizeText(post.user.handle, 200)
                        : normalizeText(source.user.name, 200) === normalizeText(post.user.name, 200)
                            ? 1
                            : 0;
                const tags = tagSimilarity(source.tags, post.tags);
                const category = source.categoryId && source.categoryId === post.categoryId ? 1 : 0;
                const contentType = (source.contentType ?? "") === (post.contentType ?? "") ? 1 : 0;
                const recency = recencyScore(post.createdAt);
                const engagement = engagementScore(post);
                const titleLengthSimilarity =
                    1 -
                    Math.min(
                        Math.abs(source.title.length - post.title.length) /
                            Math.max(source.title.length, post.title.length, 1),
                        1,
                    );
                const score =
                    titleEdit * 18 +
                    titleTokens * 12 +
                    descriptionEdit * 7 +
                    descriptionTokens * 7 +
                    captionSimilarity * 3 +
                    tags * 20 +
                    category * 12 +
                    authorExact * 8 +
                    authorEdit * 4 +
                    contentType * 2 +
                    titleLengthSimilarity * 2 +
                    recency * 3 +
                    engagement * 2;
                return { post, score };
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
