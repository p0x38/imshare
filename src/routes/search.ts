import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, parseOrder, parsePagination } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

function parseDate(value: unknown): Date | undefined {
    if (typeof value !== "string" || !value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildSearchQuery(term: string): string {
    return term
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => `"${token.replaceAll('"', '""')}"*`)
        .join(" AND ");
}

function publicPostConditions(term: string) {
    const conditions: Record<string, unknown>[] = [
        {
            status: "published",
            visibility: "public",
            hiddenAt: null,
            OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
            user: { isPublic: true, showPosts: true, showProfile: true, isBanned: false },
        },
    ];
    return { conditions, term };
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/search", async (request) => {
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const term = typeof q.q === "string" ? q.q.trim() : "";
        const type = typeof q.type === "string" ? q.type : "all";
        const order = parseOrder(q.order);
        const result: Record<string, unknown> = {};
        let total = 0;

        if (type === "posts" || type === "texts" || type === "all") {
            const { conditions } = publicPostConditions(term);
            if (term) {
                const searchQuery = buildSearchQuery(term);
                const matches = await prisma.$queryRaw<{ postId: string }[]>`
                    SELECT "postId"
                    FROM "post_search"
                    WHERE "post_search" MATCH ${searchQuery}
                    ORDER BY bm25("post_search")
                    LIMIT 1000
                `;
                conditions.push({ id: { in: matches.map((match) => match.postId) } });
            }
            if (typeof q.user === "string" && q.user) conditions.push({ userId: q.user });
            if (typeof q.category === "string" && q.category) conditions.push({ category: { slug: q.category } });
            if (typeof q.tag === "string" && q.tag) conditions.push({ tags: { some: { tag: { slug: q.tag } } } });
            if (typeof q.mime === "string" && q.mime) conditions.push({ uploads: { some: { mimeType: { contains: q.mime } } } });

            if (type === "posts") conditions.push({ uploads: { some: {} } });
            if (type === "texts") conditions.push({ uploads: { none: {} } });

            const from = parseDate(q.from);
            const to = parseDate(q.to);
            if (from || to) {
                conditions.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
            }

            const where = { AND: conditions };
            const [items, count] = await Promise.all([
                prisma.post.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: order }, include: postInclude }),
                prisma.post.count({ where }),
            ]);
            result.posts = items.map(postView);
            if (type === "texts") {
                return collection(items.map(postView), p.page, p.limit, count);
            }
            total += count;
            if (type === "posts") return collection(items.map(postView), p.page, p.limit, count);
        }

        if (type === "users" || type === "all") {
            const where = term ? { name: { contains: term }, isPublic: true, showProfile: true, isBanned: false } : { isPublic: true, showProfile: true, isBanned: false };
            const [items, count] = await Promise.all([
                prisma.user.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: order }, select: { id: true, name: true, image: true, createdAt: true } }),
                prisma.user.count({ where }),
            ]);
            result.users = items;
            total += count;
            if (type === "users") return collection(items, p.page, p.limit, count);
        }

        if (type === "tags" || type === "all") {
            const where = term ? { name: { contains: term } } : {};
            const [items, count] = await Promise.all([
                prisma.tag.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: order } }),
                prisma.tag.count({ where }),
            ]);
            result.tags = items;
            total += count;
            if (type === "tags") return collection(items, p.page, p.limit, count);
        }

        if (type === "categories" || type === "all") {
            const where = term ? { name: { contains: term } } : {};
            const [items, count] = await Promise.all([
                prisma.category.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: order } }),
                prisma.category.count({ where }),
            ]);
            result.categories = items;
            total += count;
            if (type === "categories") return collection(items, p.page, p.limit, count);
        }

        return { data: result, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
    });
};
