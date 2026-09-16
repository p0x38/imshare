import type { FastifySchema } from "fastify";

export type OpenApiRouteMetadata = {
    tags?: string | string[];
    summary?: string;
    description?: string;
    operationId?: string;
    security?: Array<Record<string, string[]>>;
    requestExample?: unknown;
    responseExamples?: Record<string, unknown>;
};

export type OpenApiRouteSchema = FastifySchema & {
    "x-imshare-openapi"?: OpenApiRouteMetadata;
};

/**
 * Define OpenAPI documentation next to its Fastify route.
 * The metadata is kept in a private extension and consumed by the Swagger transform.
 */
export function openapi(metadata: OpenApiRouteMetadata, schema: FastifySchema = {}): OpenApiRouteSchema {
    return {
        ...schema,
        "x-imshare-openapi": metadata,
    };
}
