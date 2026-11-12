import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { loadConfig } from "./config.js";
import {
    errorResponseSchema,
    postCollectionResponseSchema,
    postResponseSchema,
} from "../routes/openapi-schemas.js";
import {
    compileOpenApiOperation,
    openapiOperationId,
    openapiTagForPath,
    type OpenApiRouteMetadata,
} from "./openapi-route.js";

type OpenApiTag = {
    name: string;
    description: string;
};

type OpenApiComponentResponse = {
    description: string;
    content?: Record<
        string,
        {
            schema?: Record<string, unknown>;
            example?: unknown;
            examples?: Record<string, OpenApiComponentExample | { $ref: string }>;
        }
    >;
};

type OpenApiComponentExample = {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
};

const tags: OpenApiTag[] = [
    { name: "System", description: "Health, readiness, version, and public system information." },
    { name: "Account", description: "Authenticated account and credential management operations." },
    {
        name: "Authentication",
        description: "Authentication, registration, and account session operations.",
    },
    { name: "Users", description: "Public user discovery and user profile management." },
    {
        name: "Posts",
        description: "Post creation, retrieval, categorization, tagging, reactions, and comments.",
    },
    { name: "Tags", description: "Post tag management and discovery." },
    { name: "Categories", description: "Post category management and discovery." },
    { name: "Uploads", description: "Image upload lifecycle and image delivery." },
    { name: "Emojis", description: "Custom emoji management." },
    { name: "Notifications", description: "Authenticated notification management." },
    { name: "Social", description: "Follow, reaction, report, and recommendation operations." },
    { name: "Federation", description: "Federation and ActivityPub-compatible endpoints." },
];

function isDocumentedRoute(url: string): boolean {
    return (
        url.startsWith("/api/") ||
        url === "/.well-known/webfinger" ||
        url === "/.well-known/nodeinfo" ||
        url.startsWith("/nodeinfo/") ||
        url.startsWith("/federation/")
    );
}

export async function registerOpenApi(
    fastify: FastifyInstance,
    config: Awaited<ReturnType<typeof loadConfig>>,
) {
    await fastify.register(fastifySwagger, {
        openapi: {
            openapi: "3.0.3",
            info: {
                title: `${config.site.name} API`,
                description: config.site.description,
                version: config.site.version,
            },
            ...(config.auth.baseUrl
                ? {
                      servers: [
                          {
                              url: config.auth.baseUrl,
                              description: "Configured imshare API server",
                          },
                      ],
                  }
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
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "API token",
                        description:
                            "API token passed as Authorization: Bearer <token> for external clients.",
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
            const sourceSchema =
                schema && typeof schema === "object" ? (schema as Record<string, unknown>) : {};
            const { "x-imshare-openapi": routeMetadata, ...schemaWithoutOpenApiMetadata } =
                sourceSchema;
            const current = schemaWithoutOpenApiMetadata as Record<string, unknown>;
            const metadata =
                routeMetadata && typeof routeMetadata === "object"
                    ? (routeMetadata as OpenApiRouteMetadata)
                    : undefined;

            const compiled = compileOpenApiOperation(current as never, metadata);
            const responses = (compiled.responses as Record<string, unknown> | undefined) ?? {};

            if (Object.keys(responses).length === 0) {
                compiled.responses = {
                    "200": { description: "Successful response." },
                };
            }

            compiled.tags =
                Array.isArray(compiled.tags) && compiled.tags.length > 0
                    ? compiled.tags
                    : [openapiTagForPath(url)];

            if (!compiled.operationId && method && url) {
                compiled.operationId = openapiOperationId(method, url);
            }

            const isApiTokenManagementRoute = url.startsWith("/api/v1/me/api-tokens");

            if (
                !isApiTokenManagementRoute &&
                Array.isArray(compiled.security) &&
                compiled.security.length === 1 &&
                typeof compiled.security[0] === "object" &&
                compiled.security[0] !== null &&
                "cookieAuth" in compiled.security[0]
            ) {
                compiled.security = [{ cookieAuth: [] }, { bearerAuth: [] }];
            }

            const transformedSchema = {
                ...schemaWithoutOpenApiMetadata,
                ...compiled,
                ...(isDocumentedRoute(url) ? {} : { hide: true }),
            };

            return {
                schema: transformedSchema,
                url,
            };
        },
    });

    await fastify.register(fastifySwaggerUi, {
        routePrefix: "/docs",
    });
}

function createComponentResponses(): Record<string, OpenApiComponentResponse> {
    return {
        BadRequest: {
            description: "The request could not be validated or parsed.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                    examples: {
                        invalidRequest: {
                            summary: "Invalid request",
                            value: {
                                error: {
                                    code: "BAD_REQUEST",
                                    message: "Request validation failed.",
                                },
                            },
                        },
                    },
                },
            },
        },
        Unauthorized: {
            description: "Authentication is required or the current session is invalid.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
            },
        },
        Forbidden: {
            description: "The authenticated user is not allowed to perform this operation.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
            },
        },
        NotFound: {
            description: "The requested resource does not exist.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
            },
        },
        Conflict: {
            description: "The requested operation conflicts with the current resource state.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
            },
        },
        RateLimited: {
            description: "The request was rate limited.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
            },
        },
        InternalServerError: {
            description: "An unexpected server error occurred.",
            content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
            },
        },
    };
}
