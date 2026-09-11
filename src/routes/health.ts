import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "../lib/config.js";
import { ok } from "../lib/api.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();

    fastify.get("/v1/health", async () => ({ status: "ok" }));

    fastify.get("/v1/version", async () => ok({ api: "v1", version: config.site.version }));
};
