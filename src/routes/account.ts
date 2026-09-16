import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, ok, parsePagination, requireUser } from "../lib/api.js";
import { openapi } from "../lib/openapi-route.js";

export const accountRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/me/preferences", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const preferences = await prisma.user.findUnique({ where: { id: user.id }, select: {
            isPublic: true, followApprovalRequired: true, showEmail: true, showPosts: true, showProfile: true,
            showHandle: true, showFollowers: true, showFollowings: true, allowSearchEngineIndex: true,
            defaultCategoryId: true, defaultPostVisibility: true, defaultAllowDownload: true, defaultContentWarning: true,
        } });
        return ok(preferences);
    });

    fastify.patch("/v1/me/preferences", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const body = request.body as Record<string, unknown>;
        const booleanKeys = [
            "isPublic", "followApprovalRequired", "showEmail", "showPosts", "showProfile", "showHandle",
            "showFollowers", "showFollowings", "allowSearchEngineIndex", "defaultAllowDownload",
        ] as const;
        for (const key of booleanKeys) if (body[key] !== undefined && typeof body[key] !== "boolean")
            return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: `${key} must be a boolean.` } });
        const visibility = body.defaultPostVisibility;
        if (visibility !== undefined && !["public", "unlisted", "private"].includes(String(visibility)))
            return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: "Invalid default post visibility." } });
        const categoryId = body.defaultCategoryId;
        if (categoryId !== undefined && categoryId !== null && typeof categoryId !== "string")
            return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: "Invalid default category." } });
        if (typeof body.defaultContentWarning === "string" && body.defaultContentWarning.length > 500)
            return reply.code(400).send({ error: { code: "INVALID_PREFERENCE", message: "Default content warning is too long." } });
        if (categoryId) {
            const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
            if (!category) return reply.code(400).send({ error: { code: "CATEGORY_NOT_FOUND", message: "Default category not found." } });
        }
        const updated = await prisma.user.update({ where: { id: user.id }, data: {
            ...Object.fromEntries(booleanKeys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]])),
            ...(visibility !== undefined ? { defaultPostVisibility: String(visibility) } : {}),
            ...(categoryId !== undefined ? { defaultCategoryId: categoryId as string | null } : {}),
            ...(body.defaultContentWarning !== undefined ? { defaultContentWarning: body.defaultContentWarning ? String(body.defaultContentWarning) : null } : {}),
        }, select: {
            isPublic: true, followApprovalRequired: true, showEmail: true, showPosts: true, showProfile: true,
            showHandle: true, showFollowers: true, showFollowings: true, allowSearchEngineIndex: true,
            defaultCategoryId: true, defaultPostVisibility: true, defaultAllowDownload: true, defaultContentWarning: true,
        } });
        return ok(updated);
    });

    fastify.get("/v1/me/sessions", { schema: openapi({ tags: "Users", summary: "List current user's sessions", description: "Returns authenticated sessions for the current user, including whether each session is the current session. Supports page and limit query parameters." }) }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const q = request.query as Record<string, unknown>; const p = parsePagination(q);
        const [items, total] = await Promise.all([
            prisma.session.findMany({ where: { userId: user.id }, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
            prisma.session.count({ where: { userId: user.id } }),
        ]);
        const current = await getSession(request);
        return collection(items.map((session) => ({ ...session, current: session.id === current?.session.id })), p.page, p.limit, total);
    });

    fastify.delete("/v1/me/sessions/:sessionId", { schema: openapi({ tags: "Users", summary: "Revoke a session", description: "Revokes one session owned by the authenticated user.", responseExamples: { "200": { data: { revoked: true } }, "404": { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } } } }) }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return;
        const { sessionId } = request.params as { sessionId: string };
        const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id }, select: { id: true } });
        if (!session) return reply.code(404).send({ error: { code: "SESSION_NOT_FOUND", message: "Session not found." } });
        await prisma.session.delete({ where: { id: session.id } });
        return ok({ revoked: true });
    });
};
