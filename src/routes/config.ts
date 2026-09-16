import type { FastifyPluginAsync } from "fastify";

import { getPublicConfig, loadConfig } from "../lib/config.js";
import { openapi } from "../lib/openapi-route.js";

export const configRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/config",
        {
            schema: openapi({
                tags: "Metadata",
                summary: "Get public client configuration",
                description:
                    "Returns configuration that is safe for browser clients, including enabled authentication methods.",
                operationId: "getPublicConfig",
                responses: { "200": { description: "Public client configuration." } },
            }),
        },
        async () => ({ data: getPublicConfig(await loadConfig()) }),
    );
};
