import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, ok, parsePagination, requireUser } from "../lib/api.js";
import { openapi } from "../lib/openapi-route.js";

export const accountRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/v1/me/sessions",
        {
            schema: openapi({
                tags: "Users",
                summary: "List current user's sessions",
                description:
                    "Returns authenticated sessions for the current user, including whether each session is the current session. Supports page and limit query parameters.",
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const q = request.query as Record<string, unknown>;
            const p = parsePagination(q);
            const [items, total] = await Promise.all([
                prisma.session.findMany({
                    where: { userId: user.id },
                    skip: p.skip,
                    take: p.limit,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        createdAt: true,
                        updatedAt: true,
                        expiresAt: true,
                        ipAddress: true,
                        userAgent: true,
                    },
                }),
                prisma.session.count({ where: { userId: user.id } }),
            ]);
            const current = await getSession(request);
            return collection(
                items.map((session) => ({
                    ...session,
                    current: session.id === current?.session.id,
                })),
                p.page,
                p.limit,
                total,
            );
        },
    );

    fastify.delete(
        "/v1/me/sessions/:sessionId",
        {
            schema: openapi({
                tags: "Users",
                summary: "Revoke a session",
                description: "Revokes one session owned by the authenticated user.",
                responseExamples: {
                    "200": { data: { revoked: true } },
                    "404": { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { sessionId } = request.params as { sessionId: string };
            const session = await prisma.session.findFirst({
                where: { id: sessionId, userId: user.id },
                select: { id: true },
            });
            if (!session)
                return reply
                    .code(404)
                    .send({ error: { code: "SESSION_NOT_FOUND", message: "Session not found." } });
            await prisma.session.delete({ where: { id: session.id } });
            return ok({ revoked: true });
        },
    );
};
