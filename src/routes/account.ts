import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, ok, parsePagination, requireUser } from "../lib/api.js";
import { openapi, parameter, request } from "../lib/openapi-route.js";

const sessionId = parameter.path("sessionId", { type: "string" }, { description: "Session ID." });
const pagination = [
    parameter.query("page", { type: "integer", minimum: 1, default: 1 }, { description: "1-based page number." }),
    parameter.query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }, { description: "Maximum number of sessions to return." }),
];
const preferenceSchema = {
    type: "object" as const,
    properties: {
        isPublic: { type: "boolean" as const }, followApprovalRequired: { type: "boolean" as const }, showEmail: { type: "boolean" as const },
        showPosts: { type: "boolean" as const }, showProfile: { type: "boolean" as const }, showHandle: { type: "boolean" as const },
        showFollowers: { type: "boolean" as const }, showFollowings: { type: "boolean" as const }, allowSearchEngineIndex: { type: "boolean" as const },
        defaultCategoryId: { type: "string" as const, nullable: true }, defaultPostVisibility: { type: "string" as const, enum: ["public", "unlisted", "private"] },
        defaultAllowDownload: { type: "boolean" as const }, defaultContentWarning: { type: "string" as const, maxLength: 500, nullable: true },
    },
};

export const accountRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/me/analytics", {
        schema: openapi({
            tags: "Account",
            summary: "Get creator analytics",
            description: "Returns analytics for posts owned by the authenticated user.",
            operationId: "getMyAnalytics",
            parameters: [
                parameter.query("days", { type: "integer", minimum: 7, maximum: 90, default: 30 }, { description: "Recent period in days." }),
            ],
            responses: {
                "200": { description: "Creator analytics for the authenticated user's posts." },
                "401": { $ref: "#/components/responses/Unauthorized" },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const days = Math.min(Math.max(Number((request.query as { days?: unknown }).days) || 30, 7), 90);
        const since = new Date(Date.now() - days * 86_400_000);
        const [postTotals, recentViews, recentComments, recentReactions, recentUploads, recentUniqueViewers, recentViewTrend, topPosts] = await Promise.all([
            prisma.post.aggregate({
                where: { userId: user.id },
                _count: { _all: true },
            }),
            prisma.postView.count({ where: { viewedAt: { gte: since }, post: { userId: user.id } } }),
            prisma.comment.count({ where: { createdAt: { gte: since }, post: { userId: user.id } } }),
            prisma.postReaction.count({ where: { createdAt: { gte: since }, post: { userId: user.id } } }),
            prisma.upload.count({ where: { createdAt: { gte: since }, userId: user.id } }),
            prisma.postView.findMany({
                where: { viewedAt: { gte: since }, userId: { not: null }, post: { userId: user.id } },
                distinct: ["userId"],
                select: { userId: true },
            }),
            prisma.$queryRaw<Array<{ day: string; views: number | bigint }>>`SELECT date("viewedAt") AS day, COUNT(*) AS views FROM "post_view" WHERE "viewedAt" >= ${since} AND "postId" IN (SELECT "id" FROM "post" WHERE "userId" = ${user.id}) GROUP BY date("viewedAt") ORDER BY day ASC`,
            prisma.postView.groupBy({
                by: ["postId"],
                where: { viewedAt: { gte: since }, post: { userId: user.id } },
                _count: { _all: true },
                orderBy: { _count: { postId: "desc" } },
                take: 10,
            }),
        ]);
        const allTime = await Promise.all([
            prisma.postView.count({ where: { post: { userId: user.id } } }),
            prisma.comment.count({ where: { post: { userId: user.id } } }),
            prisma.postReaction.count({ where: { post: { userId: user.id } } }),
            prisma.upload.count({ where: { userId: user.id } }),
            prisma.follow.count({ where: { followingId: user.id, status: "approved" } }),
        ]);
        const topIds = topPosts.map((row) => row.postId);
        const titles = topIds.length
            ? new Map((await prisma.post.findMany({ where: { id: { in: topIds } }, select: { id: true, title: true } })).map((post) => [post.id, post.title]))
            : new Map<string, string>();
        return ok({
            periodDays: days,
            totals: {
                posts: postTotals._count._all,
                views: allTime[0],
                comments: allTime[1],
                reactions: allTime[2],
                uploads: allTime[3],
                followers: allTime[4],
            },
            recent: {
                views: recentViews,
                comments: recentComments,
                reactions: recentReactions,
                uploads: recentUploads,
                uniqueViewers: recentUniqueViewers.length,
            },
            viewsByDay: recentViewTrend.map((row) => ({ day: row.day, views: Number(row.views) })),
            topPosts: topPosts.map((row) => ({ postId: row.postId, title: titles.get(row.postId) ?? "Untitled", views: row._count._all })),
        });
    });

    fastify.get("/v1/me/preferences", {
        schema: openapi({
            tags: "Account", summary: "Get account preferences", description: "Returns privacy and default-post preferences for the authenticated user.", operationId: "getMyPreferences",
            responses: { "200": { description: "Current account preferences." }, "401": { $ref: "#/components/responses/Unauthorized" } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const preferences = await prisma.user.findUnique({ where: { id: user.id }, select: {
            isPublic: true, followApprovalRequired: true, showEmail: true, showPosts: true, showProfile: true, showHandle: true, showFollowers: true, showFollowings: true, allowSearchEngineIndex: true,
            defaultCategoryId: true, defaultPostVisibility: true, defaultAllowDownload: true, defaultContentWarning: true,
        } });
        return ok(preferences);
    });

    fastify.patch("/v1/me/preferences", {
        schema: openapi({
            tags: "Account", summary: "Update account preferences", description: "Updates one or more privacy or default-post preferences for the authenticated user.", operationId: "updateMyPreferences",
            requestBody: request.json(preferenceSchema, { required: true, description: "Preferences to update. All properties are optional." }),
            responses: { "200": { description: "Updated account preferences." }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" } },
            responseExamples: { "400": { error: { code: "INVALID_PREFERENCE", message: "Invalid default post visibility." } } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const body = request.body as Record<string, unknown>;
        const booleanKeys = ["isPublic", "followApprovalRequired", "showEmail", "showPosts", "showProfile", "showHandle", "showFollowers", "showFollowings", "allowSearchEngineIndex", "defaultAllowDownload"] as const;
        for (const key of booleanKeys) if (body[key] !== undefined && typeof body[key] !== "boolean") return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: `${key} must be a boolean.` } });
        const visibility = body.defaultPostVisibility;
        if (visibility !== undefined && !["public", "unlisted", "private"].includes(String(visibility))) return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: "Invalid default post visibility." } });
        const categoryId = body.defaultCategoryId;
        if (categoryId !== undefined && categoryId !== null && typeof categoryId !== "string") return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: "Invalid default category." } });
        if (typeof body.defaultContentWarning === "string" && body.defaultContentWarning.length > 500) return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: "Default content warning is too long." } });
        if (categoryId) { const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }); if (!category) return reply.code(400).send({ error: { code: "CATEGORY_NOT_FOUND", message: "Default category not found." } }); }
        const updated = await prisma.user.update({ where: { id: user.id }, data: {
            ...Object.fromEntries(booleanKeys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]])), ...(visibility !== undefined ? { defaultPostVisibility: String(visibility) } : {}),
            ...(categoryId !== undefined ? { defaultCategoryId: categoryId as string | null } : {}), ...(body.defaultContentWarning !== undefined ? { defaultContentWarning: body.defaultContentWarning ? String(body.defaultContentWarning) : null } : {}),
        }, select: {
            isPublic: true, followApprovalRequired: true, showEmail: true, showPosts: true, showProfile: true, showHandle: true, showFollowers: true, showFollowings: true, allowSearchEngineIndex: true,
            defaultCategoryId: true, defaultPostVisibility: true, defaultAllowDownload: true, defaultContentWarning: true,
        } });
        return ok(updated);
    });

    fastify.get("/v1/me/sessions", {
        schema: openapi({
            tags: "Account", summary: "List current user's sessions", description: "Returns authenticated sessions for the current user, including whether each session is current.", operationId: "listMySessions", parameters: pagination,
            responses: { "200": { description: "Paginated session collection." }, "401": { $ref: "#/components/responses/Unauthorized" } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const q = request.query as Record<string, unknown>; const p = parsePagination(q);
        const [items, total] = await Promise.all([prisma.session.findMany({ where: { userId: user.id }, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true } }), prisma.session.count({ where: { userId: user.id } })]);
        const current = await getSession(request);
        return collection(items.map((session) => ({ ...session, current: session.id === current?.session.id })), p.page, p.limit, total);
    });

    fastify.delete("/v1/me/sessions/:sessionId", {
        schema: openapi({
            tags: "Account", summary: "Revoke a session", description: "Revokes one session owned by the authenticated user.", operationId: "revokeMySession", parameters: [sessionId],
            responses: { "200": { description: "Session revoked." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } },
            responseExamples: { "200": { data: { revoked: true } }, "404": { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const { sessionId } = request.params as { sessionId: string };
        const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id }, select: { id: true } });
        if (!session) return reply.code(404).send({ error: { code: "SESSION_NOT_FOUND", message: "Session not found." } });
        await prisma.session.delete({ where: { id: session.id } });
        return ok({ revoked: true });
    });
};
