import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, ok, parsePagination, requireUser } from "../lib/api.js";

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/me/notifications", async (request, reply) => {
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

    fastify.get("/v1/me/notifications/unread-count", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        return ok({
            count: await prisma.notification.count({
                where: { recipientId: user.id, readAt: null },
            }),
        });
    });

    fastify.patch("/v1/me/notifications/:notificationId/read", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { notificationId } = request.params as { notificationId: string };
        const notification = await prisma.notification.findFirst({
            where: { id: notificationId, recipientId: user.id },
        });
        if (!notification)
            return reply.code(404).send({
                error: { code: "NOTIFICATION_NOT_FOUND", message: "Notification not found." },
            });
        return ok(
            await prisma.notification.update({
                where: { id: notificationId },
                data: { readAt: new Date() },
            }),
        );
    });

    fastify.post("/v1/me/notifications/read-all", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        await prisma.notification.updateMany({
            where: { recipientId: user.id, readAt: null },
            data: { readAt: new Date() },
        });
        return ok({ read: true });
    });
};
