import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { loadConfig } from "./config.js";

export async function registerOpenApi(
    app: FastifyInstance,
    config: Awaited<ReturnType<typeof loadConfig>>,
) {
    const baseUrl = config.auth.baseUrl?.trim();
    let serverUrl: string | undefined;
    if (baseUrl) {
        try {
            serverUrl = new URL(baseUrl).origin;
        } catch {
            // Leave servers unset when the configured base URL is invalid.
        }
    }

    await app.register(fastifySwagger, {
        openapi: {
            openapi: "3.1.0",
            info: {
                title: `${config.site.name} API`,
                description: "HTTP API for the imshare self-hosted image archive and sharing server.",
                version: "1.0.0",
            },
            ...(serverUrl ? { servers: [{ url: serverUrl }] } : {}),
            tags: [
                { name: "account", description: "Authenticated account and session endpoints." },
                { name: "auth", description: "Authentication and registration endpoints." },
                { name: "posts", description: "Post creation, retrieval, and management." },
                { name: "reactions", description: "Likes, favorites, saves, and related reactions." },
                { name: "comments", description: "Post comments and comment interactions." },
                { name: "uploads", description: "Image upload and file management endpoints." },
                { name: "images", description: "Image serving and download endpoints." },
                { name: "tags", description: "Tag management and discovery." },
                { name: "categories", description: "Category management and discovery." },
                { name: "search", description: "Search endpoints." },
                { name: "reports", description: "Content reporting endpoints." },
                { name: "health", description: "Health and readiness checks." },
                { name: "users", description: "User and profile endpoints." },
                { name: "profile-links", description: "User profile link endpoints." },
                { name: "notifications", description: "Notification endpoints." },
                { name: "recommendations", description: "Recommendation endpoints." },
                { name: "emojis", description: "Emoji endpoints." },
                { name: "admin", description: "Administrator-only endpoints." },
                { name: "meta", description: "Metadata endpoints." },
            ],
            components: {
                securitySchemes: {
                    sessionCookie: {
                        type: "apiKey",
                        in: "cookie",
                        name: "better-auth.session_token",
                        description: "Better Auth session cookie used for authenticated requests.",
                    },
                },
            },
        },
        transform: ({ schema, url }) => {
            const section = url.match(/^\/v1\/([^/]+)/)?.[1] ?? "";
            const tagMap: Record<string, string> = {
                account: "account",
                auth: "auth",
                posts: "posts",
                reactions: "reactions",
                comments: "comments",
                notifications: "notifications",
                uploads: "uploads",
                avatars: "users",
                tags: "tags",
                categories: "categories",
                search: "search",
                reports: "reports",
                recommendations: "recommendations",
                emojis: "emojis",
                admin: "admin",
                meta: "meta",
                users: "users",
                "profile-links": "profile-links",
                health: "health",
                ready: "health",
                version: "health",
                "post-lifecycle": "posts",
            };
            const tag = tagMap[section];
            if (!tag) return { schema: schema ?? {}, url };

            return {
                schema: {
                    ...(schema ?? {}),
                    tags: [...new Set([...(schema?.tags ?? []), tag])],
                },
                url,
            };
        },
        transformObject: (documentObject) => {
            if ("openapiObject" in documentObject) {
                return {
                    ...documentObject.openapiObject,
                    externalDocs: {
                        description: "imshare project documentation",
                        url: "https://github.com/p0x38/imshare",
                    },
                };
            }

            return documentObject.swaggerObject;
        },
    });

    await app.register(fastifySwaggerUi, {
        routePrefix: "/docs",
        staticCSP: false,
        uiConfig: {
            docExpansion: "list",
            deepLinking: true,
            filter: true,
            displayRequestDuration: true,
        },
    });
}
