import type { FastifySchema } from "fastify";

export type OpenApiRouteSchema = FastifySchema & {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    security?: Array<Record<string, string[]>>;
};

export type OpenApiRouteOptions = Omit<OpenApiRouteSchema, "tags"> & {
    tags?: string | string[];
    requestExample?: unknown;
    responseExamples?: Record<string, unknown>;
};

/**
 * Define the OpenAPI-facing part of a Fastify route in one place.
 *
 * The returned value is a normal Fastify schema, so it can be passed
 * directly to `schema` without introducing a separate routing abstraction.
 */
export function openapi(options: OpenApiRouteOptions): OpenApiRouteSchema {
    const { requestExample, responseExamples, tags, ...schema } = options;

    const result: OpenApiRouteSchema = {
        ...schema,
        ...(tags ? { tags: Array.isArray(tags) ? tags : [tags] } : {}),
    };

    if (requestExample !== undefined) {
        result.body = {
            ...(typeof result.body === "object" && result.body !== null ? result.body : {}),
            "x-example": requestExample,
        };
    }

    if (responseExamples) {
        const response = (result.response ?? {}) as Record<string, unknown>;
        result.response = Object.fromEntries(
            Object.entries(response).map(([status, definition]) => {
                if (!(status in responseExamples)) return [status, definition];
                const current =
                    typeof definition === "object" && definition !== null
                        ? (definition as Record<string, unknown>)
                        : {};
                return [status, { ...current, "x-example": responseExamples[status] }];
            }),
        );
    }

    return result;
}
