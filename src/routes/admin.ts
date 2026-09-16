import type { FastifyInstance } from "fastify";

import { canModerateTarget } from "../lib/permissions.js";
import { requireRole, ok } from "../lib/api.js";
import { prisma } from "../lib/auth.js";
import { loadConfig, updateConfig } from "../lib/config.js";
import { getRegistrationToken } from "../lib/registration-token.js";

function parseDuration(value: unknown): Date | null | undefined {
    if (value === undefined || value === null || value === "") return undefined;

    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0 || hours > 8760) return null;

    return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get("/v1/admin/overview", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
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
        const analytics = config.analytics ?? {};

        return ok({
            googleAnalyticsMeasurementId: analytics.googleAnalyticsMeasurementId ?? "",
            googleTagManagerContainerId: analytics.googleTagManagerContainerId ?? "",
        });
    });

    fastify.patch("/v1/admin/analytics", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;

        const body = request.body as {
            googleAnalyticsMeasurementId?: unknown;
            googleTagManagerContainerId?: unknown;
        };
        const googleAnalyticsMeasurementId =
            typeof body.googleAnalyticsMeasurementId === "string"
                ? body.googleAnalyticsMeasurementId.trim()
                : "";
        const googleTagManagerContainerId =
            typeof body.googleTagManagerContainerId === "string"
                ? body.googleTagManagerContainerId.trim()
                : "";

        if (googleAnalyticsMeasurementId && !/^G-[A-Z0-9]+$/i.test(googleAnalyticsMeasurementId)) {
            return reply.code(400).send({
                error: {
                    code: "INVALID_GA_ID",
                    message: "Invalid Google Analytics measurement ID.",
                },
            });
        }

        if (googleTagManagerContainerId && !/^GTM-[A-Z0-9]+$/i.test(googleTagManagerContainerId)) {
            return reply.code(400).send({
                error: {
                    code: "INVALID_GTM_ID",
                    message: "Invalid Google Tag Manager container ID.",
                },
            });
        }

        await updateConfig((config) => ({
            ...config,
            analytics: {
                ...config.analytics,
                googleAnalyticsMeasurementId,
                googleTagManagerContainerId,
            },
        }));

        return ok({
            googleAnalyticsMeasurementId,
            googleTagManagerContainerId,
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
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;

        const query = request.query as { limit?: unknown; offset?: unknown };
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
        const offset = Math.max(Number(query.offset) || 0, 0);
        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            skip: offset,
            take: limit,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBanned: true,
                banReason: true,
                bannedAt: true,
                bannedUntil: true,
                createdAt: true,
                handle: true,
            },
        });

        return ok(users);
    });

    fastify.get("/v1/admin/reports", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;

        const query = request.query as { status?: unknown; limit?: unknown };
        const status = typeof query.status === "string" ? query.status : "open";
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
        const reports = await prisma.report.findMany({
            where: { status },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                reporter: { select: { id: true, name: true, handle: true } },
                post: { select: { id: true, title: true } },
                comment: { select: { id: true, body: true } },
            },
        });

        return ok(reports);
    });

    fastify.patch("/v1/admin/reports/:reportId", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;

        const { reportId } = request.params as { reportId: string };
        const body = request.body as { status?: unknown };
        if (body.status !== "open" && body.status !== "resolved" && body.status !== "dismissed") {
            return reply.code(400).send({
                error: {
                    code: "INVALID_REPORT_STATUS",
                    message: "Invalid report status.",
                },
            });
        }

        const report = await prisma.report.update({
            where: { id: reportId },
            data: { status: body.status },
        });

        return ok(report);
    });

    fastify.post("/v1/admin/users/:userId/kick", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;

        const { userId } = request.params as { userId: string };
        if (actor.id === userId) {
            return reply.code(400).send({
                error: {
                    code: "CANNOT_KICK_SELF",
                    message: "You cannot kick yourself.",
                },
            });
        }

        const [actorUser, target] = await Promise.all([
            prisma.user.findUnique({
                where: { id: actor.id },
                select: { role: true },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true },
            }),
        ]);

        if (!target) {
            return reply.code(404).send({
                error: { code: "USER_NOT_FOUND", message: "User not found." },
            });
        }
        if (!actorUser || !canModerateTarget(actorUser.role, target.role)) {
            return reply.code(403).send({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot moderate this user.",
                },
            });
        }

        const result = await prisma.session.deleteMany({ where: { userId } });
        await prisma.moderationLog.create({
            data: {
                actorId: actor.id,
                targetUserId: userId,
                action: "kick",
                reason: "Sessions revoked by moderator.",
            },
        });

        return ok({ userId, sessionsRevoked: result.count });
    });

    fastify.post("/v1/admin/users/:userId/ban", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;

        const { userId } = request.params as { userId: string };
        if (actor.id === userId) {
            return reply.code(400).send({
                error: { code: "CANNOT_BAN_SELF", message: "You cannot ban yourself." },
            });
        }

        const [actorUser, target] = await Promise.all([
            prisma.user.findUnique({
                where: { id: actor.id },
                select: { role: true },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true },
            }),
        ]);

        if (!target) {
            return reply.code(404).send({
                error: { code: "USER_NOT_FOUND", message: "User not found." },
            });
        }
        if (!actorUser || !canModerateTarget(actorUser.role, target.role)) {
            return reply.code(403).send({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot moderate this user.",
                },
            });
        }

        const body = request.body as { reason?: string; durationHours?: unknown };
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason || reason.length > 500) {
            return reply.code(400).send({
                error: {
                    code: "INVALID_BAN_REASON",
                    message: "A ban reason between 1 and 500 characters is required.",
                },
            });
        }

        const bannedUntil = parseDuration(body.durationHours);
        if (bannedUntil === null) {
            return reply.code(400).send({
                error: {
                    code: "INVALID_BAN_DURATION",
                    message: "Ban duration must be between 0 and 8760 hours.",
                },
            });
        }

        const now = new Date();
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: {
                    isBanned: true,
                    banReason: reason,
                    bannedAt: now,
                    bannedUntil,
                },
            }),
            prisma.session.deleteMany({ where: { userId } }),
            prisma.moderationLog.create({
                data: {
                    actorId: actor.id,
                    targetUserId: userId,
                    action: "ban",
                    reason,
                    expiresAt: bannedUntil ?? undefined,
                },
            }),
        ]);

        return ok({ userId, isBanned: true, bannedUntil });
    });

    fastify.post("/v1/admin/users/:userId/unban", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;

        const { userId } = request.params as { userId: string };
        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });

        if (!target) {
            return reply.code(404).send({
                error: { code: "USER_NOT_FOUND", message: "User not found." },
            });
        }
        if (actor.id === userId) {
            return reply.code(400).send({
                error: {
                    code: "CANNOT_UNBAN_SELF",
                    message: "You cannot unban yourself.",
                },
            });
        }

        const actorUser = await prisma.user.findUnique({
            where: { id: actor.id },
            select: { role: true },
        });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role)) {
            return reply.code(403).send({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot moderate this user.",
                },
            });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: {
                    isBanned: false,
                    banReason: null,
                    bannedAt: null,
                    bannedUntil: null,
                },
            }),
            prisma.moderationLog.create({
                data: {
                    actorId: actor.id,
                    targetUserId: userId,
                    action: "unban",
                },
            }),
        ]);

        return ok({ userId, isBanned: false });
    });

    fastify.patch("/v1/admin/users/:userId/role", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;

        const { userId } = request.params as { userId: string };
        const body = request.body as { role?: unknown };
        if (body.role !== "user" && body.role !== "moderator" && body.role !== "admin") {
            return reply.code(400).send({
                error: {
                    code: "INVALID_ROLE",
                    message: "Role must be user, moderator, or admin.",
                },
            });
        }
        if (actor.id === userId && body.role !== "admin") {
            return reply.code(400).send({
                error: {
                    code: "CANNOT_DEMOTE_SELF",
                    message: "You cannot remove your own administrator role.",
                },
            });
        }

        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });
        if (!target) {
            return reply.code(404).send({
                error: { code: "USER_NOT_FOUND", message: "User not found." },
            });
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { role: body.role },
        });
        await prisma.moderationLog.create({
            data: {
                actorId: actor.id,
                targetUserId: userId,
                action: "role_change",
                reason: `${target.role} -> ${body.role}`,
            },
        });

        return ok(updated);
    });

    fastify.get("/v1/admin/logs", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;

        const query = request.query as { limit?: unknown };
        const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
        const logs = await prisma.moderationLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
                actor: { select: { id: true, name: true, handle: true } },
                targetUser: { select: { id: true, name: true, handle: true } },
            },
        });

        return ok(logs);
    });
}
