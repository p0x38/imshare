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

    const tagForPath = (pathname: string): string => {
        const sections = pathname.split("/").filter(Boolean);
        const section = sections[1] ?? "";
        const subSection = sections[2] ?? "";
        const thirdSection = sections[3] ?? "";

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
            users: "users",
            "profile-links": "profile-links",
            health: "health",
            ready: "health",
            version: "health",
            "registration-token": "account",
            "post-lifecycle": "posts",
        };

        let tag = tagMap[section];

        if (section === "me") {
            tag =
                subSection === "posts"
                    ? "posts"
                    : subSection === "notifications"
                      ? "notifications"
                      : subSection === "links"
                        ? "profile-links"
                        : "account";
        }

        if (section === "discovery") tag = "recommendations";

        if (section === "posts") {
            if (subSection === "image") tag = "images";
            if (
                subSection === "{postId}" &&
                (thirdSection === "reactions" || thirdSection === "{type}")
            )
                tag = "reactions";
        }

        return tag ?? "meta";
    };

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
            const pathname = url.split("?", 1)[0] ?? "/";

            if (!pathname.startsWith("/v1/"))
                return {
                    schema: { ...(schema ?? {}), hide: true },
                    url,
                };

            return {
                schema: {
                    ...(schema ?? {}),
                    tags: [...new Set([...(schema?.tags ?? []), tagForPath(pathname)])],
                },
                url,
            };
        },
        transformObject: (documentObject) => {
            const document =
                "openapiObject" in documentObject
                    ? documentObject.openapiObject
                    : documentObject.swaggerObject;

            const paths = Object.fromEntries(
                Object.entries(document.paths ?? {})
                    .filter(([pathname]) => pathname.startsWith("/v1/"))
                    .map(([pathname, pathItem]) => {
                        if (!pathItem || typeof pathItem !== "object")
                            return [pathname, pathItem] as const;

                        const tag = tagForPath(pathname);
                        const operations = new Set([
                            "get",
                            "post",
                            "put",
                            "patch",
                            "delete",
                            "options",
                            "head",
                            "trace",
                        ]);

                        const updatedPathItem = Object.fromEntries(
                            Object.entries(pathItem).map(([method, operation]) => {
                                if (!operations.has(method) || !operation || typeof operation !== "object")
                                    return [method, operation] as const;

                                const operationObject = operation as { tags?: readonly string[] };
                                return [
                                    method,
                                    {
                                        ...operationObject,
                                        tags: [...new Set([...(operationObject.tags ?? []), tag])],
                                    },
                                ] as const;
                            }),
                        );

                        return [pathname, updatedPathItem] as const;
                    }),
            );

            return {
                ...document,
                paths,
                externalDocs: {
                    description: "imshare project documentation",
                    url: "https://github.com/p0x38/imshare",
                },
            };
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
