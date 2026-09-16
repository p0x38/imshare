import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, ok, parsePagination, requireUser } from "../lib/api.js";
import { openapi, parameter } from "../lib/openapi-route.js";

const notificationId = parameter.path("notificationId", { type: "string" }, { description: "Notification ID." });
const pagination = [
    parameter.query("page", { type: "integer", minimum: 1, default: 1 }, { description: "1-based page number." }),
    parameter.query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }, { description: "Maximum number of notifications to return." }),
];

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/me/notifications", {
        schema: openapi({
            tags: "Notifications",
            summary: "List current user's notifications",
            description: "Returns the authenticated user's notifications, newest first.",
            operationId: "listMyNotifications",
            parameters: pagination,
            security: [{ cookieAuth: [] }],
            responses: { "200": { description: "Paginated notification collection." } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const q = request.query as Record<string, unknown>;
        const p = parsePagination(q);
        const where = { recipientId: user.id };
        const [items, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                include: { actor: { select: { id: true, name: true } } },
                skip: p.skip,
                take: p.limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.notification.count({ where }),
        ]);
        return collection(items, p.page, p.limit, total);
    });

    fastify.get("/v1/me/notifications/unread-count", {
        schema: openapi({
            tags: "Notifications",
            summary: "Get unread notification count",
            description: "Returns the number of unread notifications belonging to the authenticated user.",
            operationId: "getMyUnreadNotificationCount",
            security: [{ cookieAuth: [] }],
            responses: { "200": { description: "Unread notification count." } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        return ok({ count: await prisma.notification.count({ where: { recipientId: user.id, readAt: null } }) });
    });

    fastify.patch("/v1/me/notifications/:notificationId/read", {
        schema: openapi({
            tags: "Notifications",
            summary: "Mark notification as read",
            description: "Marks one notification owned by the authenticated user as read.",
            operationId: "markNotificationRead",
            parameters: [notificationId],
            security: [{ cookieAuth: [] }],
            responses: {
                "200": { description: "Updated notification." },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "404": { $ref: "#/components/responses/NotFound" },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { notificationId } = request.params as { notificationId: string };
        const notification = await prisma.notification.findFirst({ where: { id: notificationId, recipientId: user.id } });
        if (!notification) return reply.code(404).send({ error: { code: "NOTIFICATION_NOT_FOUND", message: "Notification not found." } });
        return ok(await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } }));
    });

    fastify.post("/v1/me/notifications/read-all", {
        schema: openapi({
            tags: "Notifications",
            summary: "Mark all notifications as read",
            description: "Marks all unread notifications belonging to the authenticated user as read.",
            operationId: "markAllNotificationsRead",
            security: [{ cookieAuth: [] }],
            responses: { "200": { description: "All notifications marked as read." } },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        await prisma.notification.updateMany({ where: { recipientId: user.id, readAt: null }, data: { readAt: new Date() } });
        return ok({ read: true });
    });
};
