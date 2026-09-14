import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, ok, requireRole } from "../lib/api.js";
import { canModerateTarget, isUserRole } from "../lib/permissions.js";
import { getRegistrationToken } from "../lib/registration-token.js";
import { loadConfig, updateConfig } from "../lib/config.js";

function parseDuration(value: unknown): Date | null | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24 * 365) return null;
    return hours === 0 ? null : new Date(Date.now() + hours * 60 * 60 * 1000);
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/admin/overview", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const [users, posts, openReports, bannedUsers, admins, moderators] = await Promise.all([
            prisma.user.count(),
            prisma.post.count(),
            prisma.report.count({ where: { status: "open" } }),
            prisma.user.count({ where: { isBanned: true } }),
            prisma.user.count({ where: { role: "admin" } }),
            prisma.user.count({ where: { role: "moderator" } }),
        ]);
        return ok({ users, posts, openReports, bannedUsers, admins, moderators });
    });

    fastify.get("/v1/admin/analytics", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const config = await loadConfig();
        return ok({
            googleAnalyticsMeasurementId: config.analytics?.googleAnalyticsMeasurementId ?? "",
            googleTagManagerContainerId: config.analytics?.googleTagManagerContainerId ?? "",
        });
    });

    fastify.patch("/v1/admin/analytics", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const body = request.body as Record<string, unknown>;
        const googleAnalyticsMeasurementId = typeof body.googleAnalyticsMeasurementId === "string"
            ? body.googleAnalyticsMeasurementId.trim()
            : "";
        const googleTagManagerContainerId = typeof body.googleTagManagerContainerId === "string"
            ? body.googleTagManagerContainerId.trim()
            : "";
        if (googleAnalyticsMeasurementId && !/^G-[A-Z0-9]+$/i.test(googleAnalyticsMeasurementId))
            return reply.code(400).send({
                error: { code: "INVALID_GA_ID", message: "Google Analytics measurement ID must look like G-XXXXXXXXXX." },
            });
        if (googleTagManagerContainerId && !/^GTM-[A-Z0-9]+$/i.test(googleTagManagerContainerId))
            return reply.code(400).send({
                error: { code: "INVALID_GTM_ID", message: "Google Tag Manager container ID must look like GTM-XXXXXXX." },
            });
        const config = await updateConfig((current) => ({
            ...current,
            analytics: {
                googleAnalyticsMeasurementId,
                googleTagManagerContainerId,
            },
        }));
        return ok({
            googleAnalyticsMeasurementId: config.analytics?.googleAnalyticsMeasurementId ?? "",
            googleTagManagerContainerId: config.analytics?.googleTagManagerContainerId ?? "",
        });
    });

    fastify.get("/v1/admin/registration-token", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        return ok(getRegistrationToken());
    });

    fastify.post("/v1/admin/registration-token", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        return ok(getRegistrationToken());
    });

    fastify.get("/v1/admin/users", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const q = request.query as Record<string, unknown>;
        const page = Math.max(1, Number(q.page ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50) || 50));
        const search = typeof q.search === "string" ? q.search.trim() : "";
        const role = isUserRole(q.role) ? q.role : undefined;
        const banned = q.banned === "true" ? true : q.banned === "false" ? false : undefined;
        const where = {
            ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
            ...(role ? { role } : {}),
            ...(banned !== undefined ? { isBanned: banned } : {}),
        };
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: { id: true, name: true, email: true, role: true, isPublic: true, showEmail: true, showPosts: true, showProfile: true, isBanned: true, banReason: true, bannedAt: true, bannedUntil: true, createdAt: true, updatedAt: true },
            }),
            prisma.user.count({ where }),
        ]);
        return collection(users, page, limit, total);
    });

    fastify.get("/v1/admin/reports", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const q = request.query as Record<string, unknown>;
        const status = q.status === "resolved" || q.status === "dismissed" ? q.status : "open";
        const page = Math.max(1, Number(q.page ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50) || 50));
        const where = { status };
        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: { reporter: { select: { id: true, name: true, email: true } }, post: { select: { id: true, title: true, userId: true } }, comment: { select: { id: true, body: true, userId: true, postId: true } } },
            }),
            prisma.report.count({ where }),
        ]);
        return collection(reports, page, limit, total);
    });

    fastify.patch("/v1/admin/reports/:reportId", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const { reportId } = request.params as { reportId: string };
        const body = request.body as { status?: string };
        if (body.status !== "open" && body.status !== "resolved" && body.status !== "dismissed") return reply.code(400).send({ error: { code: "INVALID_REPORT_STATUS", message: "Invalid report status." } });
        const report = await prisma.report.update({ where: { id: reportId }, data: { status: body.status } });
        await prisma.moderationLog.create({ data: { actorId: actor.id, targetUserId: report.reporterId, action: "report_status", reason: `Report ${body.status}.` } });
        return ok(report);
    });

    fastify.post("/v1/admin/users/:userId/kick", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        if (actor.id === userId) return reply.code(400).send({ error: { code: "CANNOT_KICK_SELF", message: "You cannot kick yourself." } });
        const [actorUser, target] = await Promise.all([prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } }), prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })]);
        if (!target) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role)) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot moderate this user." } });
        const result = await prisma.session.deleteMany({ where: { userId } });
        await prisma.moderationLog.create({ data: { actorId: actor.id, targetUserId: userId, action: "kick", reason: "Sessions revoked by moderator." } });
        return ok({ userId, sessionsRevoked: result.count });
    });

    fastify.post("/v1/admin/users/:userId/ban", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        if (actor.id === userId) return reply.code(400).send({ error: { code: "CANNOT_BAN_SELF", message: "You cannot ban yourself." } });
        const [actorUser, target] = await Promise.all([prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } }), prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })]);
        if (!target) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role)) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot moderate this user." } });
        const body = request.body as { reason?: string; durationHours?: unknown };
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason || reason.length > 500) return reply.code(400).send({ error: { code: "INVALID_BAN_REASON", message: "A ban reason between 1 and 500 characters is required." } });
        const bannedUntil = parseDuration(body.durationHours);
        if (bannedUntil === null) return reply.code(400).send({ error: { code: "INVALID_BAN_DURATION", message: "Ban duration must be between 0 and 8760 hours." } });
        const now = new Date();
        await prisma.$transaction([prisma.user.update({ where: { id: userId }, data: { isBanned: true, banReason: reason, bannedAt: now, bannedUntil } }), prisma.session.deleteMany({ where: { userId } }), prisma.moderationLog.create({ data: { actorId: actor.id, targetUserId: userId, action: "ban", reason, expiresAt: bannedUntil ?? undefined } })]);
        return ok({ userId, isBanned: true, bannedUntil });
    });

    fastify.post("/v1/admin/users/:userId/unban", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        const [actorUser, target] = await Promise.all([prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } }), prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })]);
        if (!target) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role)) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot moderate this user." } });
        await prisma.user.update({ where: { id: userId }, data: { isBanned: false, banReason: null, bannedAt: null, bannedUntil: null } });
        await prisma.moderationLog.create({ data: { actorId: actor.id, targetUserId: userId, action: "unban", reason: "Ban removed by moderator." } });
        return ok({ userId, isBanned: false });
    });

    fastify.patch("/v1/admin/users/:userId/role", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        if (actor.id === userId) return reply.code(400).send({ error: { code: "CANNOT_CHANGE_SELF_ROLE", message: "You cannot change your own role." } });
        const body = request.body as { role?: unknown };
        if (!isUserRole(body.role)) return reply.code(400).send({ error: { code: "INVALID_ROLE", message: "Invalid user role." } });
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
        if (!target) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (target.role === "admin" && body.role !== "admin" && (await prisma.user.count({ where: { role: "admin" } })) <= 1) return reply.code(400).send({ error: { code: "LAST_ADMIN", message: "The last admin cannot be demoted." } });
        const updated = await prisma.user.update({ where: { id: userId }, data: { role: body.role } });
        await prisma.moderationLog.create({ data: { actorId: actor.id, targetUserId: userId, action: "role_change", reason: `Role changed from ${target.role} to ${body.role}.` } });
        return ok({ id: updated.id, role: updated.role });
    });

    fastify.get("/v1/admin/logs", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const logs = await prisma.moderationLog.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, name: true } }, targetUser: { select: { id: true, name: true } } } });
        return ok(logs);
    });
};
