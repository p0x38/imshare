import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "../lib/config.js";
import { ok } from "../lib/api.js";
import { prisma } from "../lib/auth.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();

    fastify.get("/v1/health", async () => ({ status: "ok" }));

    fastify.get("/v1/ready", async (_request, reply) => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return { status: "ready" };
        } catch {
            return reply.code(503).send({
                error: {
                    code: "SERVICE_NOT_READY",
                    message: "The service is not ready.",
                },
            });
        }
    });

    fastify.get("/v1/version", async () => ok({ api: "v1", version: config.site.version }));
};
