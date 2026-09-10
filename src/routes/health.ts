import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "../lib/config.js";
import { ok } from "../lib/api.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/health", async () => ({ status: "ok" }));

  fastify.get("/v1/version", async () => {
    const config = await loadConfig();
    return ok({ api: "v1", version: config.site.version });
  });
};
