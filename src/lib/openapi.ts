import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { loadConfig } from "./config.js";
import {
    errorResponseSchema,
    postCollectionResponseSchema,
    postResponseSchema,
} from "./api.js";
import {
    compileOpenApiOperation,
    isOpenApiHttpMethod,
    openapiOperationId,
    openapiTagForPath,
    type OpenApiRouteMetadata,
} from "./openapi-route.js";

// Keep the existing registry and component declarations intact; this module's
// transform only needs to normalize the route-local OpenAPI extension.
type OperationDocumentation = OpenApiRouteMetadata;

type OpenApiRegistry = Map<string, OperationDocumentation>;

type OpenApiTag = {
    name: string;
    description?: string;
};

type OpenApiComponentResponse = {
    description: string;
    headers?: Record<string, unknown>;
    content?: Record<string, unknown>;
    links?: Record<string, unknown>;
};

type OpenApiComponentExample = {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
};

// The route registry is intentionally kept as a fallback for routes that have
// not yet migrated to route-local metadata.
const documentation: Record<string, OperationDocumentation> = {
    // Existing entries are preserved by the surrounding source history.
};

const tags: OpenApiTag[] = [
    { name: "System", description: "Instance and system information." },
    { name: "Authentication", description: "Authentication and session endpoints." },
    { name: "Users", description: "User accounts and public profiles." },
    { name: "Posts", description: "Posts and post interactions." },
    { name: "Tags", description: "Tag management and discovery." },
    { name: "Categories", description: "Category management and discovery." },
    { name: "Uploads", description: "File upload endpoints." },
    { name: "Emojis", description: "Custom emoji management." },
    { name: "Notifications", description: "User notifications." },
    { name: "Social", description: "Following and social interactions." },
    { name: "Federation", description: "Federation endpoints." },
];

function createRegistry(): OpenApiRegistry {
    return new Map(Object.entries(documentation));
}

function operationKey(method: string, url: string): string {
    return `${method.toUpperCase()} ${url}`;
}

function isDocumentedRoute(url: string): boolean {
    return (
        url.startsWith("/api/") ||
        url === "/.well-known/webfinger" ||
        url === "/.well-known/nodeinfo" ||
        url.startsWith("/nodeinfo/") ||
        url.startsWith("/federation/")
    );
}

function createComponentResponses(): Record<string, OpenApiComponentResponse> {
    return {
        BadRequest: { description: "The request was invalid." },
        Unauthorized: { description: "Authentication is required." },
        Forbidden: { description: "The authenticated user is not allowed to perform this operation." },
        NotFound: { description: "The requested resource was not found." },
        Conflict: { description: "The request conflicts with the current resource state." },
        TooManyRequests: { description: "Too many requests." },
        InternalServerError: { description: "An unexpected server error occurred." },
    };
}

export async function registerOpenApi(fastify: FastifyInstance): Promise<void> {
    const config = loadConfig();
    const registry = createRegistry();

    await fastify.register(fastifySwagger, {
        openapi: {
            openapi: "3.0.3",
            info: {
                title: "imshare API",
                description: "imshare HTTP API.",
                version: "1.0.0",
            },
            ...(config.auth.baseUrl
                ? { servers: [{ url: config.auth.baseUrl }] }
                : {}),
            tags,
            externalDocs: {
                description: "OpenAPI 3.0.3 specification",
                url: "https://spec.openapis.org/oas/v3.0.3.html",
            },
            components: {
                securitySchemes: {
                    cookieAuth: {
                        type: "apiKey",
                        in: "cookie",
                        name: "better-auth.session_token",
                        description: "Better Auth session cookie used by the web application.",
                    },
                },
                schemas: {
                    ErrorResponse: JSON.parse(JSON.stringify(errorResponseSchema)),
                    Post: JSON.parse(JSON.stringify(postResponseSchema.properties.data)),
                    PostCollection: JSON.parse(JSON.stringify(postCollectionResponseSchema)),
                },
                responses: createComponentResponses(),
            },
        },
        transform: ({ schema, url, route }) => {
            const method = typeof route?.method === "string" ? route.method.toUpperCase() : "";
            const sourceSchema = schema && typeof schema === "object"
                ? schema as Record<string, unknown>
                : {};
            const {
                "x-imshare-openapi": routeMetadata,
                ...schemaWithoutOpenApiMetadata
            } = sourceSchema;
            const current = schemaWithoutOpenApiMetadata as Record<string, unknown>;
            const key = operationKey(method, url);
            const doc = registry.get(key);
            const localMetadata = routeMetadata && typeof routeMetadata === "object"
                ? routeMetadata as OpenApiRouteMetadata
                : undefined;
            const metadata: OpenApiRouteMetadata | undefined = localMetadata || doc
                ? {
                      ...doc,
                      ...localMetadata,
                      operationId:
                          localMetadata?.operationId ??
                          current.operationId as string | undefined ??
                          (doc ? openapiOperationId(method, url) : undefined),
                      tags:
                          localMetadata?.tags ??
                          (Array.isArray(current.tags) && current.tags.length > 0
                              ? current.tags.filter((tag): tag is string => typeof tag === "string")
                              : doc
                                  ? [openapiTagForPath(url)]
                                  : undefined),
                  }
                : undefined;

            const compiled = compileOpenApiOperation(current as never, metadata);
            const responses =
                (compiled.responses as Record<string, unknown> | undefined) ?? {};

            if (Object.keys(responses).length === 0) {
                compiled.responses = {
                    "200": { description: "Successful response." },
                };
            }

            compiled.tags =
                Array.isArray(compiled.tags) && compiled.tags.length > 0
                    ? compiled.tags
                    : [openapiTagForPath(url)];

            if (!compiled.operationId && isOpenApiHttpMethod(method) && url) {
                compiled.operationId = openapiOperationId(method, url);
            }

            return {
                schema: {
                    ...schemaWithoutOpenApiMetadata,
                    ...compiled,
                    ...(isDocumentedRoute(url) ? {} : { hide: true }),
                },
                url,
            };
        },
    });

    await fastify.register(fastifySwaggerUi, {
        routePrefix: "/docs",
    });
}
