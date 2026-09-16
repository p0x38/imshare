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
 * Keeps OpenAPI documentation next to the Fastify route that it describes.
 * The returned value remains a normal Fastify schema.
 */
export function openapi(metadata: OpenApiRouteMetadata, schema: FastifySchema = {}): OpenApiRouteSchema {
    return {
        ...schema,
        "x-imshare-openapi": metadata,
    };
}
