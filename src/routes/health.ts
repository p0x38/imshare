import type { FastifyPluginAsync } from "fastify";

import packageJson from "../../package.json" with { type: "json" };
import { ok } from "../lib/api.js";
import { getBuildInfo } from "../lib/build-info.js";
import { prisma } from "../lib/auth.js";
import { openapi } from "../lib/openapi-route.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
    const build = getBuildInfo();

    fastify.get(
        "/v1/health",
        {
            schema: openapi({
                tags: "Health",
                summary: "Check service health",
                description:
                    "Returns a lightweight health response without checking backing services.",
                responseExamples: { "200": { status: "ok" } },
            }),
        },
        async () => ({ status: "ok" }),
    );

    fastify.get(
        "/v1/ready",
        {
            schema: openapi({
                tags: "Health",
                summary: "Check service readiness",
                description:
                    "Checks whether the database is reachable. Returns 503 when the service is not ready.",
                responseExamples: {
                    "200": { status: "ready" },
                    "503": {
                        error: { code: "SERVICE_NOT_READY", message: "The service is not ready." },
                    },
                },
            }),
        },
        async (_request, reply) => {
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
        },
    );

    fastify.get(
        "/v1/version",
        {
            schema: openapi({
                tags: "Health",
                summary: "Get API version",
                description: "Returns the API version and the running imshare version.",
                responseExamples: { "200": { data: { api: "v1", version: "1.0.0" } } },
            }),
        },
        async () =>
            ok({
                api: "v1",
                version: packageJson.version,
                commitHash: build.commitHash,
                commitMessage: build.commitMessage,
            }),
    );
};
