import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { loadConfig } from "./config.js";
import { errorResponseSchema, postCollectionResponseSchema, postResponseSchema } from "../routes/openapi-schemas.js";

type OperationDocumentation = {
    summary: string;
    description: string;
    requestExample?: unknown;
    responseExamples?: Record<string, unknown>;
};

const documentation: Record<string, OperationDocumentation> = {
    "GET /v1/health": { summary: "Check service health", description: "Returns a lightweight health response without checking backing services.", responseExamples: { "200": { status: "ok" } } },
    "GET /v1/ready": { summary: "Check service readiness", description: "Checks whether the database is reachable. Returns 503 when the service is not ready.", responseExamples: { "200": { status: "ready" }, "503": { error: { code: "SERVICE_NOT_READY", message: "The service is not ready." } } } },
    "GET /v1/version": { summary: "Get API version", description: "Returns the API version and the running imshare version.", responseExamples: { "200": { data: { api: "v1", version: "1.0.0" } } } },
    "GET /v1/me": { summary: "Get current user", description: "Returns the authenticated user's profile, email, profile links, post count, and avatar URL." },
    "GET /v1/me/posts": { summary: "List current user's posts", description: "Returns the authenticated user's posts as a paginated collection. Supports page, limit, and order query parameters." },
    "GET /v1/me/sessions": { summary: "List current user's sessions", description: "Returns authenticated sessions for the current user, including whether each session is the current session. Supports page and limit query parameters." },
    "DELETE /v1/me/sessions/{sessionId}": { summary: "Revoke a session", description: "Revokes one session owned by the authenticated user.", responseExamples: { "200": { data: { revoked: true } }, "404": { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } } } },
    "GET /v1/me/notifications": { summary: "List current user's notifications", description: "Returns the authenticated user's notifications, newest first. Supports page and limit query parameters." },
    "GET /v1/me/notifications/unread-count": { summary: "Get unread notification count", description: "Returns the number of unread notifications belonging to the authenticated user." },
    "PATCH /v1/me/notifications/{notificationId}/read": { summary: "Mark notification as read", description: "Marks one notification owned by the authenticated user as read." },
    "POST /v1/me/notifications/read-all": { summary: "Mark all notifications as read", description: "Marks all notifications owned by the authenticated user as read." },
    "POST /v1/me/links": { summary: "Create a profile link", description: "Creates a profile link for the authenticated user. The URL must be HTTP(S), the label must be 1–100 characters, and each user may have at most 20 links.", requestExample: { label: "GitHub", url: "https://github.com/example" } },
    "PATCH /v1/me/links/{linkId}": { summary: "Update a profile link", description: "Updates a profile link owned by the authenticated user.", requestExample: { label: "GitHub", url: "https://github.com/example" } },
    "DELETE /v1/me/links/{linkId}": { summary: "Delete profile link", description: "Deletes a profile link owned by the authenticated user. Returns 204 on success." },
    "GET /v1/users": { summary: "List users", description: "Returns a paginated public user list. Supports page, limit, search, and order query parameters." },
    "POST /v1/users": { summary: "Create a user", description: "Creates a user directly. Authentication is required. The name and email are required.", requestExample: { name: "Example User", email: "user@example.com", bio: "Example profile" } },
    "GET /v1/users/{userId}": { summary: "Get user profile", description: "Returns a public user profile including profile fields, post count, profile links, and an avatar URL." },
    "PATCH /v1/users/{userId}": { summary: "Update user profile", description: "Updates the authenticated user's own profile. Supported fields include name, image, bio, websiteUrl, githubUrl, avatarMode, avatarValue, profileBannerUrl, and accentColor.", requestExample: { name: "Example User", bio: "Updated profile", avatarMode: "initials", accentColor: "#7c4dff" } },
    "DELETE /v1/users/{userId}": { summary: "Delete user account", description: "Deletes the authenticated user's own account. Returns 204 on success." },
    "GET /v1/users/{userId}/posts": { summary: "List user's posts", description: "Returns a paginated list of posts belonging to the specified user. Supports page, limit, and order query parameters." },
    "GET /v1/users/{userId}/links": { summary: "List user's profile links", description: "Returns the public profile links belonging to the specified user." },
    "GET /v1/users/{userId}/avatar": { summary: "Get user avatar", description: "Returns or redirects to the user's generated, custom, or Gravatar avatar." },
    "GET /v1/posts": { summary: "List posts", description: "Returns public posts as a paginated collection. Search matches title, description, and caption. Supports page, limit, user, tag, category, search, and order query parameters." },
    "POST /v1/posts": { summary: "Create post", description: "Creates a post for the authenticated user. Uploads must be owned by the user and unused. Supports title (1–500), description (≤10000), caption (≤10000), sourceUrl (≤4096), allowDownload, up to 100 tags, an optional categoryId, and up to 100 uploadIds.", requestExample: { title: "Example post", description: "An example description.", caption: "Example caption", sourceUrl: "https://example.com/source", allowDownload: true, tags: ["example"], categoryId: "category-id", uploadIds: ["upload-id"] } },
    "GET /v1/posts/{postId}": { summary: "Get post", description: "Returns the public representation of a post." },
    "PATCH /v1/posts/{postId}": { summary: "Update post", description: "Updates a post owned by the authenticated user.", requestExample: { title: "Updated title", description: "Updated description", allowDownload: false } },
    "DELETE /v1/posts/{postId}": { summary: "Delete post", description: "Deletes a post owned by the authenticated user. Returns 204 on success." },
    "GET /v1/posts/{postId}/tags": { summary: "List post tags", description: "Returns the tags attached to a public post." },
    "POST /v1/posts/{postId}/tags": { summary: "Add post tag", description: "Adds a tag to a post owned by the authenticated user. Existing associations are upserted.", requestExample: { tagId: "tag-id" } },
    "DELETE /v1/posts/{postId}/tags/{tagId}": { summary: "Remove post tag", description: "Removes a tag from a post owned by the authenticated user. Returns 204 on success." },
    "GET /v1/posts/{postId}/category": { summary: "Get post category", description: "Returns the category attached to a public post, or null when no category is assigned." },
    "PUT /v1/posts/{postId}/category": { summary: "Set post category", description: "Sets the category for a post owned by the authenticated user.", requestExample: { categoryId: "category-id" } },
    "DELETE /v1/posts/{postId}/category": { summary: "Clear post category", description: "Removes the category from a post owned by the authenticated user. Returns 204 on success." },
    "GET /v1/posts/{postId}/reactions": { summary: "Get post reactions", description: "Returns reaction counts and, when authenticated, the current user's active reaction state." },
    "PUT /v1/posts/{postId}/{type}": { summary: "Add post reaction", description: "Adds a reaction to a post. Supported reaction types are like, favorite, and save. Authentication is required." },
    "DELETE /v1/posts/{postId}/{type}": { summary: "Remove post reaction", description: "Removes a reaction from a post. Supported reaction types are like, favorite, and save. Authentication is required." },
    "GET /v1/posts/{postId}/comments": { summary: "List post comments", description: "Returns public comments for a post as a paginated collection, ordered oldest first. Supports page and limit query parameters." },
    "POST /v1/posts/{postId}/comments": { summary: "Create comment", description: "Creates a comment on a post. The body must be 1–5000 characters and authentication is required.", requestExample: { body: "This is an example comment." } },
    "PATCH /v1/comments/{commentId}": { summary: "Edit comment", description: "Edits a comment owned by the authenticated user.", requestExample: { body: "Updated comment text." } },
    "DELETE /v1/comments/{commentId}": { summary: "Delete comment", description: "Deletes a comment owned by the authenticated user or a comment on the authenticated user's post. Returns 204 on success." },
    "PUT /v1/comments/{commentId}/like": { summary: "Like comment", description: "Adds the authenticated user's like to a comment." },
    "DELETE /v1/comments/{commentId}/like": { summary: "Remove comment like", description: "Removes the authenticated user's like from a comment." },
    "POST /v1/reports": { summary: "Create content report", description: "Reports exactly one post or comment. Supported reasons are spam, copyright, harassment, illegal, sexual, violence, and other. Optional details are limited to 2000 characters. Duplicate open reports return 409 REPORT_EXISTS.", requestExample: { postId: "post-id", reason: "spam", details: "Example report details." }, responseExamples: { "409": { error: { code: "REPORT_EXISTS", message: "An open report already exists." } } } },
    "GET /v1/tags": { summary: "List tags", description: "Returns paginated public tags. Supports page, limit, search, and order query parameters." },
    "POST /v1/tags": { summary: "Create tag", description: "Creates a tag for the authenticated user. The slug must match ^[a-z0-9]+(?:-[a-z0-9]+)*$.", requestExample: { name: "Example Tag", slug: "example-tag" } },
    "GET /v1/tags/{tagId}": { summary: "Get tag", description: "Returns a public tag and its post count." },
    "PATCH /v1/tags/{tagId}": { summary: "Update tag", description: "Updates a tag. Authentication is required.", requestExample: { name: "Updated Tag", slug: "updated-tag" } },
    "DELETE /v1/tags/{tagId}": { summary: "Delete tag", description: "Deletes a tag. Returns 204 on success." },
    "GET /v1/tags/{tagId}/posts": { summary: "List posts for tag", description: "Returns a paginated list of public posts associated with a tag. Supports page, limit, and order query parameters." },
    "GET /v1/categories": { summary: "List categories", description: "Returns paginated public categories. Supports page, limit, and order query parameters." },
    "POST /v1/categories": { summary: "Create category", description: "Creates a category for the authenticated user. Name and slug are required; description is optional.", requestExample: { name: "Example Category", slug: "example-category", description: "An example category." } },
    "GET /v1/categories/{categoryId}": { summary: "Get category", description: "Returns a public category and its post count." },
    "PATCH /v1/categories/{categoryId}": { summary: "Update category", description: "Updates a category. Authentication is required.", requestExample: { name: "Updated Category", slug: "updated-category", description: "Updated description." } },
    "DELETE /v1/categories/{categoryId}": { summary: "Delete category", description: "Deletes a category. Returns 204 on success." },
    "GET /v1/categories/{categoryId}/posts": { summary: "List posts for category", description: "Returns a paginated list of public posts associated with a category. Supports page, limit, and order query parameters." },
    "GET /v1/search": { summary: "Search imshare", description: "Searches posts, users, tags, and categories. Query parameters include q, type, user, tag, category, page, limit, and order. type may be all, posts, users, tags, or categories." },
    "POST /v1/uploads": { summary: "Upload image", description: "Uploads one or more images using multipart/form-data. Supported types are JPG/JPEG, PNG, GIF, WebP, BMP, and AVIF. Extension, MIME type, file signature, and configured size are validated. Set multiple=true to upload up to 20 files." },
    "GET /v1/uploads/{uploadId}": { summary: "Get upload metadata", description: "Returns upload metadata for an upload owned by the authenticated user." },
    "DELETE /v1/uploads/{uploadId}": { summary: "Delete upload", description: "Deletes an unused upload owned by the authenticated user. Attached uploads return 409 UPLOAD_IN_USE. Returns 204 on success.", responseExamples: { "409": { error: { code: "UPLOAD_IN_USE", message: "Upload is already attached to a post." } } } },
    "GET /v1/posts/image/{uploadId}": { summary: "Deliver image", description: "Delivers a public image with optional resize and format conversion. width and height accept 16–4096. fit is cover, contain, fill, inside, or outside. format is webp, jpeg, jpg, png, or avif. download=true requests download mode. The default fit is inside and transformed responses are cached." },
    "GET /v1/posts/image/{uploadId}/placeholder": { summary: "Get image placeholder", description: "Returns a public ThumbHash PNG placeholder for an image." },
    "GET /v1/emojis": { summary: "List custom emojis", description: "Returns the public custom emoji list." },
    "POST /v1/emojis": { summary: "Create custom emoji", description: "Creates a custom emoji from an owned imshare image URL. The name must be 1–32 lowercase letters, numbers, underscore, plus, or hyphen characters.", requestExample: { name: "cool_emoji", imageUrl: "https://example.com/v1/posts/image/upload-id" } },
    "DELETE /v1/emojis/{emojiId}": { summary: "Delete custom emoji", description: "Deletes a custom emoji owned by the authenticated user. Returns 204 on success." },
    "GET /v1/recommendations": { summary: "Get recommendations", description: "Returns paginated public post recommendations. Authenticated sessions use reacted post tags and categories as preferences and exclude the authenticated user's own posts." },
    "GET /v1/admin/overview": { summary: "Get moderation overview", description: "Returns moderator/admin summary counts." },
    "GET /v1/admin/registration-token": { summary: "Get registration token", description: "Returns the current registration token. Admin access is required." },
    "GET /v1/admin/users": { summary: "List users for moderation", description: "Returns a paginated user list for moderators and administrators. Supports page, limit, search, role, and banned filters. Limit is 1–100 and defaults to 50." },
    "GET /v1/admin/reports": { summary: "List moderation reports", description: "Returns moderation reports for moderators and administrators. status may be open, resolved, or dismissed; the default is open. Supports page and limit." },
    "PATCH /v1/admin/reports/{reportId}": { summary: "Update report status", description: "Changes the status of a moderation report. Moderator/admin access is required.", requestExample: { status: "resolved" } },
    "POST /v1/admin/users/{userId}/kick": { summary: "Kick user sessions", description: "Revokes all active sessions for the target user. Moderator/admin access is required." },
    "POST /v1/admin/users/{userId}/ban": { summary: "Ban user", description: "Bans a user and revokes their sessions. The reason is 1–500 characters. durationHours is optional, accepts 0–8760, and 0 means an indefinite ban.", requestExample: { reason: "Repeated policy violations.", durationHours: 24 } },
};

export async function registerOpenApi(app: FastifyInstance, config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
    await app.register(fastifySwagger, {
        openapi: {
            openapi: "3.1.0",
            info: { title: "imshare API", description: "Public HTTP API for imshare.", version: "1.0.0" },
            servers: [{ url: "/" }],
            tags: [
                { name: "health", description: "Service health and metadata." },
                { name: "me", description: "Authenticated user operations." },
                { name: "users", description: "Public and authenticated user operations." },
                { name: "posts", description: "Post creation, retrieval, and management." },
                { name: "reactions", description: "Post reactions." },
                { name: "comments", description: "Post comments and comment reactions." },
                { name: "reports", description: "Content reporting." },
                { name: "tags", description: "Tag management." },
                { name: "categories", description: "Category management." },
                { name: "search", description: "Search." },
                { name: "uploads", description: "Image uploads and delivery." },
                { name: "emojis", description: "Custom emojis." },
                { name: "recommendations", description: "Post recommendations." },
                { name: "admin", description: "Administrative and moderation operations." },
            ],
            components: {
                securitySchemes: {
                    cookieAuth: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
                },
            },
        },
        transformObject(documentObject) {
            const document = "openapiObject" in documentObject ? documentObject.openapiObject : documentObject.swaggerObject;
            const documentRecord = document as Record<string, unknown>;
            const existingComponents = (documentRecord.components as Record<string, unknown> | undefined) ?? {};
            const existingSchemas = (existingComponents.schemas as Record<string, unknown> | undefined) ?? {};
            const paths = Object.fromEntries(
                Object.entries(document.paths ?? {}).filter(([pathname]) => pathname.startsWith("/v1"))
                    .map(([pathname, pathItem]) => {
                        const tag = pathname.split("/")[2] ?? "general";
                        const updatedPathItem = Object.fromEntries(Object.entries(pathItem ?? {}).map(([method, operation]) => {
                            if (!operation || typeof operation !== "object") return [method, operation];
                            const operationObject = operation as Record<string, unknown>;
                            const key = `${method.toUpperCase()} ${pathname}`;
                            const doc = documentation[key];
                            const parameters = Array.isArray(operationObject.parameters) ? operationObject.parameters : [];
                            const responses = operationObject.responses && typeof operationObject.responses === "object" ? { ...(operationObject.responses as Record<string, unknown>) } : {};
                            for (const [status, example] of Object.entries(doc?.responseExamples ?? {})) {
                                const existing: Record<string, unknown> = responses[status] && typeof responses[status] === "object" ? { ...(responses[status] as Record<string, unknown>) } : { description: `HTTP ${status} response.` };
                                const content: Record<string, Record<string, unknown>> = existing.content && typeof existing.content === "object" ? { ...(existing.content as Record<string, Record<string, unknown>>) } : { "application/json": { schema: { type: "object" } } };
                                const contentType = Object.keys(content)[0] ?? "application/json";
                                const mediaType = { ...(content[contentType] ?? {}) };
                                mediaType.example = example;
                                content[contentType] = mediaType;
                                responses[status] = { ...existing, content };
                            }
                            const schemaName = pathname === "/v1/posts" ? (method === "get" ? "PostCollectionResponse" : "PostResponse") : pathname.startsWith("/v1/posts/") && method === "get" ? "PostResponse" : null;
                            if (schemaName && responses["200"] && typeof responses["200"] === "object") {
                                responses["200"] = { ...(responses["200"] as Record<string, unknown>), content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } } };
                            }
                            const updatedOperation: Record<string, unknown> = {
                                ...operationObject,
                                tags: [...new Set([...(Array.isArray(operationObject.tags) ? operationObject.tags : []), tag])],
                                ...(doc ? { summary: operationObject.summary ?? doc.summary, description: operationObject.description ? `${operationObject.description}\n\n${doc.description}` : doc.description } : { summary: operationObject.summary ?? `${method.toUpperCase()} ${pathname}`, description: operationObject.description ?? `HTTP ${method.toUpperCase()} endpoint for ${tag}.` }),
                                parameters,
                                responses,
                            };
                            if (doc?.requestExample !== undefined) {
                                const existingRequestBody = updatedOperation.requestBody && typeof updatedOperation.requestBody === "object" ? { ...(updatedOperation.requestBody as Record<string, unknown>) } : {};
                                const content: Record<string, Record<string, unknown>> = existingRequestBody.content && typeof existingRequestBody.content === "object" ? { ...(existingRequestBody.content as Record<string, Record<string, unknown>>) } : { "application/json": { schema: { type: "object" } } };
                                const contentType = Object.keys(content)[0] ?? "application/json";
                                const mediaType = { ...(content[contentType] ?? {}) };
                                mediaType.example = doc.requestExample;
                                content[contentType] = mediaType;
                                updatedOperation.requestBody = { ...existingRequestBody, content };
                            }
                            return [method, updatedOperation] as const;
                        }));
                        return [pathname, updatedPathItem] as const;
                    }),
            );
            return {
                ...document,
                paths,
                components: {
                    ...existingComponents,
                    schemas: {
                        ...existingSchemas,
                        ErrorResponse: errorResponseSchema,
                        PostResponse: postResponseSchema,
                        PostCollectionResponse: postCollectionResponseSchema,
                    },
                },
                externalDocs: { description: "imshare project documentation", url: "https://github.com/p0x38/imshare" },
            };
        },
    });

    await app.register(fastifySwaggerUi, {
        routePrefix: "/docs",
        staticCSP: false,
        uiConfig: { docExpansion: "list", deepLinking: true, filter: true, displayRequestDuration: true },
    });
}