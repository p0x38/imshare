import type { FastifyRequest } from "fastify";
import type { loadConfig } from "../lib/config.js";

type AppConfig = Awaited<ReturnType<typeof loadConfig>>;

export function resolveRequestOrigin(config: AppConfig, request: FastifyRequest): string {
    const configuredOrigin = config.auth.baseUrl?.trim();

    if (configuredOrigin) {
        try {
            return new URL(configuredOrigin).origin;
        } catch {
            // Fall back to the request origin.
        }
    }

    return `${request.protocol}://${request.hostname}`;
}
