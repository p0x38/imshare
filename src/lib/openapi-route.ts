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
 *
 * Standard OpenAPI operation fields are emitted directly into the Fastify
 * schema so @fastify/swagger can consume them without a separate registry.
 * Examples are retained in a private extension for the existing transformer.
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
        ...(metadata.requestExample !== undefined || metadata.responseExamples !== undefined
            ? { "x-imshare-openapi": metadata }
            : {}),
    };
}

export function openapiTagForPath(url: string): string {
    const segment = url.split("?", 1)[0]?.split("/")[2] ?? "general";

    switch (segment) {
        case "auth":
            return "Authentication";
        case "me":
        case "users":
            return "Users";
        case "admin":
            return "Administration";
        case "health":
        case "ready":
        case "version":
            return "Health";
        case "posts":
            return "Posts";
        case "comments":
            return "Comments";
        case "reports":
            return "Reports";
        case "tags":
            return "Tags";
        case "categories":
            return "Categories";
        case "uploads":
            return "Uploads";
        case "emojis":
            return "Emojis";
        case "search":
            return "Search";
        case "recommendations":
            return "Recommendations";
        default:
            return "General";
    }
}
