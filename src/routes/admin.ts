import type { FastifyInstance } from "fastify";
import { canModerateTarget } from "../lib/permissions.js";
import { requireRole, ok } from "../lib/api.js";
import { prisma } from "../lib/auth.js";
import { loadConfig, readConfigText, saveConfigText, updateConfig } from "../lib/config.js";
import { getRegistrationToken } from "../lib/registration-token.js";
import { sanitizeManualBadges, userBadges } from "../lib/user-badges.js";
import { buildDailyAnalytics } from "../lib/analytics.js";

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
        const days = Math.min(
            Math.max(Number((request.query as { days?: unknown }).days) || 30, 7),
            90,
        );
        const since = new Date(Date.now() - days * 86_400_000);
        const [
            users,
            posts,
            comments,
            reactions,
            uploads,
            views,
            uniqueViewers,
            trend,
            topViewRows,
        ] = await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: since } } }),
            prisma.post.count({ where: { createdAt: { gte: since } } }),
            prisma.comment.count({ where: { createdAt: { gte: since } } }),
            prisma.postReaction.count({ where: { createdAt: { gte: since } } }),
            prisma.upload.count({ where: { createdAt: { gte: since } } }),
            prisma.postView.count({ where: { viewedAt: { gte: since } } }),
            prisma.postView.findMany({
                where: { viewedAt: { gte: since }, userId: { not: null } },
                distinct: ["userId"],
                select: { userId: true },
            }),
            prisma.$queryRaw<
                Array<{ day: string; metric: string; value: number | bigint }>
            >`SELECT day, metric, value FROM (
SELECT date("viewedAt") AS day, 'views' AS metric, COUNT(*) AS value FROM "post_view" WHERE "viewedAt" >= ${since} GROUP BY date("viewedAt")
UNION ALL SELECT date("createdAt") AS day, 'users' AS metric, COUNT(*) AS value FROM "user" WHERE "createdAt" >= ${since} GROUP BY date("createdAt")
UNION ALL SELECT date("createdAt") AS day, 'posts' AS metric, COUNT(*) AS value FROM "post" WHERE "createdAt" >= ${since} GROUP BY date("createdAt")
UNION ALL SELECT date("createdAt") AS day, 'comments' AS metric, COUNT(*) AS value FROM "comment" WHERE "createdAt" >= ${since} GROUP BY date("createdAt")
UNION ALL SELECT date("createdAt") AS day, 'reactions' AS metric, COUNT(*) AS value FROM "post_reaction" WHERE "createdAt" >= ${since} GROUP BY date("createdAt")
UNION ALL SELECT date("createdAt") AS day, 'uploads' AS metric, COUNT(*) AS value FROM "upload" WHERE "createdAt" >= ${since} GROUP BY date("createdAt")
) ORDER BY day ASC`,
            prisma.postView.groupBy({
                by: ["postId"],
                where: { viewedAt: { gte: since } },
                _count: { _all: true },
                orderBy: { _count: { postId: "desc" } },
                take: 10,
            }),
        ]);
        const topIds = topViewRows.map((row) => row.postId);
        const topPosts = topIds.length
            ? await prisma.post.findMany({
                  where: { id: { in: topIds } },
                  select: { id: true, title: true },
              })
            : [];
        const titles = new Map(topPosts.map((post) => [post.id, post.title]));
        return ok({
            periodDays: days,
            totals: {
                users,
                posts,
                comments,
                reactions,
                uploads,
                views,
                uniqueViewers: uniqueViewers.length,
            },
            viewsByDay: trend
                .filter((row) => row.metric === "views")
                .map((row) => ({ day: row.day, views: Number(row.value) })),
            activityByDay: buildDailyAnalytics(days, trend),
            topPosts: topViewRows.map((row) => ({
                postId: row.postId,
                title: titles.get(row.postId) ?? "Untitled",
                views: row._count._all,
            })),
        });
    });
    fastify.patch("/v1/admin/analytics", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const body = request.body as {
            googleAnalyticsMeasurementId?: unknown;
            googleTagManagerContainerId?: unknown;
        };
        const ga =
            typeof body.googleAnalyticsMeasurementId === "string"
                ? body.googleAnalyticsMeasurementId.trim()
                : "";
        const gtm =
            typeof body.googleTagManagerContainerId === "string"
                ? body.googleTagManagerContainerId.trim()
                : "";
        if (ga && !/^G-[A-Z0-9]+$/i.test(ga))
            return reply
                .code(400)
                .send({
                    error: {
                        code: "INVALID_GA_ID",
                        message: "Invalid Google Analytics measurement ID.",
                    },
                });
        if (gtm && !/^GTM-[A-Z0-9]+$/i.test(gtm))
            return reply
                .code(400)
                .send({
                    error: {
                        code: "INVALID_GTM_ID",
                        message: "Invalid Google Tag Manager container ID.",
                    },
                });
        await updateConfig((config) => ({
            ...config,
            analytics: {
                ...config.analytics,
                googleAnalyticsMeasurementId: ga,
                googleTagManagerContainerId: gtm,
            },
        }));
        return ok({ googleAnalyticsMeasurementId: ga, googleTagManagerContainerId: gtm });
    });
    fastify.get("/v1/admin/settings", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const config = await loadConfig();
        return ok({
            site: config.site,
            auth: {
                emailAndPasswordEnabled: config.auth.emailAndPasswordEnabled ?? true,
                registration: {
                    enabled: config.auth.registration?.enabled ?? true,
                    public: config.auth.registration?.public ?? false,
                },
            },
            analytics: config.analytics ?? {},
            features: config.features ?? {},
            limits: config.limits ?? {},
        });
    });
    fastify.patch("/v1/admin/settings", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const body = request.body as {
            analytics?: {
                googleAnalyticsMeasurementId?: unknown;
                googleTagManagerContainerId?: unknown;
            };
            auth?: {
                emailAndPasswordEnabled?: unknown;
                registration?: { enabled?: unknown; public?: unknown };
            };
        };
        if (body.analytics) {
            const ga =
                typeof body.analytics.googleAnalyticsMeasurementId === "string"
                    ? body.analytics.googleAnalyticsMeasurementId.trim()
                    : "";
            const gtm =
                typeof body.analytics.googleTagManagerContainerId === "string"
                    ? body.analytics.googleTagManagerContainerId.trim()
                    : "";
            if (ga && !/^G-[A-Z0-9]+$/i.test(ga))
                return reply
                    .code(400)
                    .send({
                        error: {
                            code: "INVALID_GA_ID",
                            message: "Invalid Google Analytics measurement ID.",
                        },
                    });
            if (gtm && !/^GTM-[A-Z0-9]+$/i.test(gtm))
                return reply
                    .code(400)
                    .send({
                        error: {
                            code: "INVALID_GTM_ID",
                            message: "Invalid Google Tag Manager container ID.",
                        },
                    });
        }
        const updated = await updateConfig((config) => ({
            ...config,
            ...(body.analytics
                ? {
                      analytics: {
                          ...config.analytics,
                          googleAnalyticsMeasurementId:
                              typeof body.analytics!.googleAnalyticsMeasurementId === "string"
                                  ? body.analytics!.googleAnalyticsMeasurementId.trim()
                                  : "",
                          googleTagManagerContainerId:
                              typeof body.analytics!.googleTagManagerContainerId === "string"
                                  ? body.analytics!.googleTagManagerContainerId.trim()
                                  : "",
                      },
                  }
                : {}),
            ...(body.auth
                ? {
                      auth: {
                          ...config.auth,
                          emailAndPasswordEnabled:
                              typeof body.auth.emailAndPasswordEnabled === "boolean"
                                  ? body.auth.emailAndPasswordEnabled
                                  : config.auth.emailAndPasswordEnabled,
                          registration: {
                              ...config.auth.registration,
                              enabled:
                                  typeof body.auth.registration?.enabled === "boolean"
                                      ? body.auth.registration.enabled
                                      : config.auth.registration?.enabled,
                              public:
                                  typeof body.auth.registration?.public === "boolean"
                                      ? body.auth.registration.public
                                      : config.auth.registration?.public,
                          },
                      },
                  }
                : {}),
        }));
        return ok({
            site: updated.site,
            auth: {
                emailAndPasswordEnabled: updated.auth.emailAndPasswordEnabled,
                registration: updated.auth.registration,
            },
            analytics: updated.analytics ?? {},
            features: updated.features ?? {},
            limits: updated.limits ?? {},
        });
    });
    fastify.get("/v1/admin/config", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        return ok({ content: await readConfigText() });
    });
    fastify.put("/v1/admin/config", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const body = request.body as { content?: unknown };
        if (typeof body.content !== "string")
            return reply.code(400).send({
                error: {
                    code: "INVALID_CONFIG",
                    message: "Configuration content must be a string.",
                },
            });
        try {
            const config = await saveConfigText(body.content);
            return ok({ config, restartRequired: true });
        } catch (error) {
            return reply.code(400).send({
                error: {
                    code: "INVALID_CONFIG",
                    message: error instanceof Error ? error.message : "Invalid configuration.",
                },
            });
        }
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
                badgesJson: true,
            },
        });
        return ok(
            users.map((user) => ({ ...user, manualBadges: JSON.parse(user.badgesJson || "[]") })),
        );
    });
    fastify.get("/v1/admin/posts", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const query = request.query as {
            limit?: unknown;
            offset?: unknown;
            search?: unknown;
            status?: unknown;
            visibility?: unknown;
        };
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
        const offset = Math.max(Number(query.offset) || 0, 0);
        const where: Record<string, unknown> = {};
        if (typeof query.search === "string" && query.search.trim())
            where.OR = [
                { title: { contains: query.search.trim() } },
                { description: { contains: query.search.trim() } },
            ];
        if (typeof query.status === "string") where.status = query.status;
        if (typeof query.visibility === "string") where.visibility = query.visibility;
        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: where as never,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    status: true,
                    visibility: true,
                    hiddenAt: true,
                    createdAt: true,
                    updatedAt: true,
                    user: { select: { id: true, name: true, handle: true } },
                    _count: { select: { reports: true, comments: true, reactions: true } },
                },
            }),
            prisma.post.count({ where: where as never }),
        ]);
        return ok({ posts, total });
    });
    fastify.patch("/v1/admin/posts/:postId", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const { postId } = request.params as { postId: string };
        const body = request.body as {
            title?: unknown;
            description?: unknown;
            caption?: unknown;
            contentWarning?: unknown;
            visibility?: unknown;
            status?: unknown;
            allowDownload?: unknown;
        };
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (body.status !== undefined && !["draft", "published"].includes(String(body.status)))
            return reply
                .code(400)
                .send({ error: { code: "INVALID_STATUS", message: "Invalid post status." } });
        if (
            body.visibility !== undefined &&
            !["public", "unlisted", "private"].includes(String(body.visibility))
        )
            return reply
                .code(400)
                .send({
                    error: { code: "INVALID_VISIBILITY", message: "Invalid post visibility." },
                });
        await prisma.postRevision.create({
            data: {
                postId,
                title: post.title,
                description: post.description,
                caption: post.caption,
                sourceUrl: post.sourceUrl,
                allowDownload: post.allowDownload,
                categoryId: post.categoryId,
                tagsJson: JSON.stringify([]),
                contentWarning: post.contentWarning,
                createdById: actor.id,
            },
        });
        const updated = await prisma.post.update({
            where: { id: postId },
            data: {
                title: typeof body.title === "string" ? body.title.trim() : undefined,
                description:
                    typeof body.description === "string"
                        ? body.description
                        : body.description === null
                          ? null
                          : undefined,
                caption:
                    typeof body.caption === "string"
                        ? body.caption
                        : body.caption === null
                          ? null
                          : undefined,
                contentWarning:
                    typeof body.contentWarning === "string"
                        ? body.contentWarning
                        : body.contentWarning === null
                          ? null
                          : undefined,
                visibility: typeof body.visibility === "string" ? body.visibility : undefined,
                status: typeof body.status === "string" ? body.status : undefined,
                allowDownload:
                    typeof body.allowDownload === "boolean" ? body.allowDownload : undefined,
            },
        });
        await prisma.moderationLog.create({
            data: {
                actorId: actor.id,
                targetUserId: post.userId,
                action: "post_edit",
                reason: `Post ${postId} edited by administrator.`,
            },
        });
        return ok(updated);
    });
    fastify.delete("/v1/admin/posts/:postId", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, userId: true, title: true },
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        const body = request.body as { reason?: unknown };
        const reason =
            typeof body?.reason === "string" ? body.reason.trim() : "Administrator deleted post.";
        await prisma.post.delete({ where: { id: postId } });
        await prisma.moderationLog.create({
            data: {
                actorId: actor.id,
                targetUserId: post.userId,
                action: "post_delete",
                reason: reason.slice(0, 500),
            },
        });
        return reply.code(204).send();
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
        if (!["open", "resolved", "dismissed"].includes(String(body.status)))
            return reply
                .code(400)
                .send({
                    error: { code: "INVALID_REPORT_STATUS", message: "Invalid report status." },
                });
        return ok(
            await prisma.report.update({
                where: { id: reportId },
                data: { status: body.status as string },
            }),
        );
    });
    fastify.post("/v1/admin/users/:userId/kick", async (request, reply) => {
        const actor = await requireRole(request, reply, "moderator");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        if (actor.id === userId)
            return reply
                .code(400)
                .send({
                    error: { code: "CANNOT_KICK_SELF", message: "You cannot kick yourself." },
                });
        const [actorUser, target] = await Promise.all([
            prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } }),
            prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
        ]);
        if (!target)
            return reply
                .code(404)
                .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role))
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You cannot moderate this user." } });
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
        if (actor.id === userId)
            return reply
                .code(400)
                .send({ error: { code: "CANNOT_BAN_SELF", message: "You cannot ban yourself." } });
        const [actorUser, target] = await Promise.all([
            prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } }),
            prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
        ]);
        if (!target)
            return reply
                .code(404)
                .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role))
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You cannot moderate this user." } });
        const body = request.body as { reason?: string; durationHours?: unknown };
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason || reason.length > 500)
            return reply
                .code(400)
                .send({
                    error: {
                        code: "INVALID_BAN_REASON",
                        message: "A ban reason between 1 and 500 characters is required.",
                    },
                });
        const bannedUntil = parseDuration(body.durationHours);
        if (bannedUntil === null)
            return reply
                .code(400)
                .send({
                    error: {
                        code: "INVALID_BAN_DURATION",
                        message: "Ban duration must be between 0 and 8760 hours.",
                    },
                });
        const now = new Date();
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { isBanned: true, banReason: reason, bannedAt: now, bannedUntil },
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
        if (!target)
            return reply
                .code(404)
                .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (actor.id === userId)
            return reply
                .code(400)
                .send({
                    error: { code: "CANNOT_UNBAN_SELF", message: "You cannot unban yourself." },
                });
        const actorUser = await prisma.user.findUnique({
            where: { id: actor.id },
            select: { role: true },
        });
        if (!actorUser || !canModerateTarget(actorUser.role, target.role))
            return reply
                .code(403)
                .send({ error: { code: "FORBIDDEN", message: "You cannot moderate this user." } });
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { isBanned: false, banReason: null, bannedAt: null, bannedUntil: null },
            }),
            prisma.moderationLog.create({
                data: { actorId: actor.id, targetUserId: userId, action: "unban" },
            }),
        ]);
        return ok({ userId, isBanned: false });
    });
    fastify.patch("/v1/admin/users/:userId/badges", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, createdAt: true, badgesJson: true },
        });
        if (!target)
            return reply
                .code(404)
                .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        const body = request.body as { badges?: unknown };
        if (!Array.isArray(body.badges))
            return reply
                .code(400)
                .send({ error: { code: "INVALID_BADGES", message: "Badges must be an array." } });
        const badges = sanitizeManualBadges(body.badges);
        await prisma.user.update({
            where: { id: userId },
            data: { badgesJson: JSON.stringify(badges) },
        });
        await prisma.moderationLog.create({
            data: {
                actorId: actor.id,
                targetUserId: userId,
                action: "badge_change",
                reason: JSON.stringify(badges),
            },
        });
        return ok({
            userId,
            badges: userBadges({ ...target, badgesJson: JSON.stringify(badges) }),
            manualBadges: badges,
        });
    });
    fastify.patch("/v1/admin/users/:userId/role", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;
        const { userId } = request.params as { userId: string };
        const body = request.body as { role?: unknown };
        if (!["user", "moderator", "admin"].includes(String(body.role)))
            return reply
                .code(400)
                .send({
                    error: {
                        code: "INVALID_ROLE",
                        message: "Role must be user, moderator, or admin.",
                    },
                });
        if (actor.id === userId && body.role !== "admin")
            return reply
                .code(400)
                .send({
                    error: {
                        code: "CANNOT_DEMOTE_SELF",
                        message: "You cannot remove your own administrator role.",
                    },
                });
        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });
        if (!target)
            return reply
                .code(404)
                .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { role: body.role as string },
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
        return ok(
            await prisma.moderationLog.findMany({
                orderBy: { createdAt: "desc" },
                take: limit,
                include: {
                    actor: { select: { id: true, name: true, handle: true } },
                    targetUser: { select: { id: true, name: true, handle: true } },
                },
            }),
        );
    });
}
