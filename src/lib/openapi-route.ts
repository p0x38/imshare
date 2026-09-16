import type { FastifySchema } from "fastify";

export type OpenApiRouteMetadata = {
    tags?: string | string[];
    summary?: string;
    description?: string;
    operationId?: string;
    security?: Array<Record<string, string[]>>;
};

export type OpenApiRouteSchema = FastifySchema & {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    security?: Array<Record<string, string[]>>;
};

/**
 * Define OpenAPI metadata next to its Fastify route.
 * The result is a normal Fastify schema, so no custom routing layer is needed.
 */
export function openapi(metadata: OpenApiRouteMetadata, schema: FastifySchema = {}): OpenApiRouteSchema {
    return {
        ...schema,
        ...(metadata.tags
            ? { tags: Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags] }
            : {}),
        ...(metadata.summary ? { summary: metadata.summary } : {}),
        ...(metadata.description ? { description: metadata.description } : {}),
        ...(metadata.operationId ? { operationId: metadata.operationId } : {}),
        ...(metadata.security ? { security: metadata.security } : {}),
    };
}
