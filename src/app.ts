import Fastify, { LogController, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./lib/config.js";
import { renderErrorPage } from "./client/lib/error-page.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { isSameOriginRequest } from "./lib/csrf.js";
import { getSession } from "./lib/api.js";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { federationRoutes } from "./routes/federation.js";
import { metaRoutes } from "./routes/meta.js";
import { pageRoutes } from "./routes/pages.js";
import { prisma } from "./lib/auth.js";
import { registerOpenApi } from "./lib/openapi.js";
import { observability } from "./instrumentation.js";
import { authorizeApiTokenRequest } from "./lib/api-tokens.js";
import { postPermalink } from "./lib/post-permalink.js";
import { crawlerMetaContent, resolveCrawlerPolicy } from "./lib/crawler-policy.js";
import {
    removeMeilisearchUserPosts,
    syncMeilisearchPosts,
    syncMeilisearchUserPosts,
} from "./lib/meilisearch.js";
import fastifyRateLimit from "@fastify/rate-limit";
import { resolveStorageDirectory } from "./lib/storage-directories.js";
import { generateSeoMetadata, truncateDescription, type SeoProfileMetadata } from "./utils/seo.js";
import { escapeAttribute } from "./utils/html.js";
import { resolveRequestOrigin } from "./utils/request.js";
import { postIdsForSearchSync } from "./utils/meilisearch.js";
import { analyticsBody, analyticsHead } from "./utils/analytics.js";

const logLevel = process.env.NODE_ENV === "test" ? "error" : "info";

interface PostFallbackData {
    title: string | null;
    description: string | null;
    textContent: string | null;
    caption: string | null;
}

function renderPostFallback(
    post: PostFallbackData,
    imageUrl?: string,
    imageAlt?: string | null,
): string {
    const title = post.title?.trim() || "Untitled";
    const description = post.description?.trim() || "";
    const text = post.textContent?.trim() || post.caption?.trim() || "";

    const descriptionHtml =
        description && description !== text ? `<p>${escapeAttribute(description)}</p>` : "";

    const textHtml = text
        ? `<div class="post-content-fallback__text" style="white-space: pre-wrap">${escapeAttribute(text)}</div>`
        : "";

    const imageHtml = imageUrl
        ? [
              "<figure>",
              +`<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(imageAlt?.trim() || title)}" loading="eager" fetchpriority="high" decoding="async" style="max-width: 100%; height: auto; object-fit: contain;">`,
              +"</figure>",
          ].join("")
        : "";

    return [
        '<main id="post-content-fallback">',
        "<article>",
        `<h1>${escapeAttribute(title)}</h1>`,
        descriptionHtml,
        textHtml,
        imageHtml,
        "</article>",
        "</main>",
    ].join("");
}

const logger = process.stdout.isTTY
    ? {
          level: logLevel,
          transport: {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
                  ignore: "pid,hostname",
                  singleLine: true,
              },
          },
      }
    : {
          level: logLevel,
      };

export async function buildApp() {
    const config = await loadConfig();
    const app = Fastify({
        logger,

        trustProxy: config.server.reverseProxied ? config.server.trustedProxies : false,

        logController: new LogController({ disableRequestLogging: true }),
        ajv: {
            plugins: [(ajv) => ajv.addKeyword({ keyword: "example", valid: true })],
        },
    });

    await app.register(fastifyRateLimit, {
        global: true,
        max: 1_000,
        timeWindow: "1 minute",

        errorResponseBuilder: (_request, context) => ({
            error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: `Rate limit exceeded. Try again in ${context.after}.`,
            },
        }),

        onExceeded: () => {
            observability.recordRateLimitHit("global");
        },
    });

    const viewLimiter = new RateLimiter(75, 60_000);
    const highVolumeImageLimiter = new RateLimiter(12_500, 60_000);
    const publicUploadReadLimiter = new RateLimiter(12_500, 60_000);
    const uploadDailyLimiter = new RateLimiter(950, 86_400_000);
    const uploadBurstLimiter = new RateLimiter(20, 120_000);
    const authMutationLimiter = new RateLimiter(30, 60_000);
    const federationInboxLimiter = new RateLimiter(300, 60_000);
    const apiMutationLimiter = new RateLimiter(300, 60_000);
    const rateLimitingEnabled = process.env.NODE_ENV !== "test";
    const requestStarted = new WeakMap<FastifyRequest, bigint>();
    const rootDir = process.cwd();
    const publicDir = path.join(rootDir, "public");
    const clientDistDir = path.join(rootDir, "dist", "client");
    const uploadDir = resolveStorageDirectory(config, "uploads");
    app.decorate("observability", observability);
    observability.register(app);
    observability.setGaugeReader(async () => {
        const [registeredUsers, publishedPosts, pendingReports] = await Promise.all([
            prisma.user.count(),
            prisma.post.count({ where: { status: "published" } }),
            prisma.report.count({ where: { status: "open" } }),
        ]);
        return { registeredUsers, publishedPosts, pendingReports };
    });

    app.addHook("onRequest", async (request) => {
        requestStarted.set(request, process.hrtime.bigint());
    });

    app.addHook("onRequest", async (request, reply) => {
        const key = request.ip || "unknown";
        const requestOrigin = resolveRequestOrigin(config, request);
        const localAdminOrigin =
            config.admin?.local?.enabled === false
                ? null
                : `http://127.0.0.1:${config.admin?.local?.port ?? 5107}`;
        const mainOriginAllowed = isSameOriginRequest(
            request.method,
            requestOrigin,
            request.headers.origin,
            request.headers.referer,
        );
        const localOriginAllowed =
            localAdminOrigin !== null &&
            isSameOriginRequest(
                request.method,
                localAdminOrigin,
                request.headers.origin,
                request.headers.referer,
            );
        if (!mainOriginAllowed && !localOriginAllowed) {
            observability.recordCsrfRejection();
            return reply.code(403).send({
                error: {
                    code: "CSRF_ORIGIN_REJECTED",
                    message: "The request origin is not allowed.",
                },
            });
        }
        const pathname = request.url.split("?", 1)[0] ?? "/";
        const method = request.method;
        const applyRateLimit = (
            limiter: RateLimiter,
            limit: number,
            scope: string,
            message: string,
        ) => {
            const result = limiter.consume(key);
            reply
                .header("X-RateLimit-Limit", String(limit))
                .header("X-RateLimit-Remaining", String(result.remaining));
            if (!rateLimitingEnabled || result.allowed) return false;
            observability.recordRateLimitHit(scope);
            reply
                .code(429)
                .header("Retry-After", String(result.retryAfter))
                .send({ error: { code: "RATE_LIMITED", message } });
            return true;
        };
        if (
            method === "POST" &&
            pathname.startsWith("/api/v1/auth/") &&
            applyRateLimit(
                authMutationLimiter,
                30,
                "auth_mutation",
                "Too many authentication requests. Try again later.",
            )
        )
            return reply;
        if (
            method === "POST" &&
            /^\/federation\/actors\/[^/]+\/inbox$/.test(pathname) &&
            applyRateLimit(
                federationInboxLimiter,
                300,
                "federation_inbox",
                "Too many incoming federation activities. Try again later.",
            )
        )
            return reply;
        if (
            (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") &&
            pathname.startsWith("/api/v1/") &&
            pathname !== "/api/v1/uploads" &&
            pathname !== "/api/v1/posts/postybirb" &&
            applyRateLimit(
                apiMutationLimiter,
                300,
                "api_mutation",
                "Too many API requests. Try again later.",
            )
        )
            return reply;
        if (
            request.method === "POST" &&
            (pathname === "/api/v1/uploads" || pathname === "/api/v1/posts/postybirb")
        ) {
            const daily = uploadDailyLimiter.consume(key);
            const burst = uploadBurstLimiter.consume(key);

            reply
                .header("X-RateLimit-Limit", "950")
                .header("X-RateLimit-Remaining", String(daily.remaining))
                .header("X-RateLimit-Burst-Limit", "20")
                .header("X-RateLimit-Burst-Remaining", String(burst.remaining));

            if (rateLimitingEnabled && !daily.allowed) {
                observability.recordRateLimitHit("upload_daily");
                return reply
                    .code(429)
                    .header("Retry-After", String(daily.retryAfter))
                    .send({
                        error: {
                            code: "UPLOAD_RATE_LIMITED",
                            message: "Daily upload limit exceeded. Try again later.",
                        },
                    });
            }

            if (rateLimitingEnabled && !burst.allowed) {
                observability.recordRateLimitHit("upload_burst");
                return reply
                    .code(429)
                    .header("Retry-After", String(burst.retryAfter))
                    .send({
                        error: {
                            code: "UPLOAD_RATE_LIMITED",
                            message: "Upload rate limit exceeded. Try again later.",
                        },
                    });
            }

            return;
        }
        if (
            (method === "GET" || method === "HEAD") &&
            pathname.startsWith("/api/v1/posts/image/")
        ) {
            if (
                applyRateLimit(
                    highVolumeImageLimiter,
                    12_500,
                    "api_image_get",
                    "Too many image requests. Try again later.",
                )
            )
                return reply;
        } else if (
            (method === "GET" || method === "HEAD") &&
            pathname.startsWith("/uploads/") &&
            applyRateLimit(
                publicUploadReadLimiter,
                12_500,
                "public_upload_read",
                "Too many image requests. Try again later.",
            )
        ) {
            return reply;
        } else if (
            request.method === "GET" &&
            pathname.startsWith("/api/v1/") &&
            !pathname.startsWith("/api/v1/health") &&
            !pathname.startsWith("/api/v1/ready")
        ) {
            const result = viewLimiter.consume(key);
            reply
                .header("X-RateLimit-Limit", "75")
                .header("X-RateLimit-Remaining", String(result.remaining));
            if (rateLimitingEnabled && !result.allowed) {
                observability.recordRateLimitHit("api_get");
                return reply
                    .code(429)
                    .header("Retry-After", String(result.retryAfter))
                    .send({
                        error: {
                            code: "RATE_LIMITED",
                            message: "Too many requests. Try again later.",
                        },
                    });
            }
        }
        viewLimiter.prune();
        highVolumeImageLimiter.prune();
        publicUploadReadLimiter.prune();
        uploadDailyLimiter.prune();
        uploadBurstLimiter.prune();
        authMutationLimiter.prune();
        federationInboxLimiter.prune();
        apiMutationLimiter.prune();
    });

    app.addHook("onRequest", async (request, reply) => {
        if (!(await authorizeApiTokenRequest(request, reply))) return reply;
    });

    app.addHook("onError", async (request, _reply, error) => {
        const statusCode = error.statusCode ?? 500;

        if (statusCode < 500) return;

        const pathname = request.url.split("?", 1)[0] ?? "/";
        const route = request.routeOptions?.url ?? pathname;

        request.log.error(
            {
                event: "http.error",
                method: request.method,
                path: pathname,
                route,
                statusCode,
                err: error,
            },
            `HTTP request failed: ${request.method} ${pathname} -> ${statusCode} (${error.name}): ${error.message}`,
        );
    });

    app.addHook("onResponse", async (request, reply) => {
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (pathname === observability.prometheusPath) return;

        const startedAt = requestStarted.get(request);
        const durationMs =
            startedAt === undefined
                ? undefined
                : Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        const durationText = durationMs === undefined ? "" : ` in ${durationMs.toFixed(1)}ms`;
        request.log.info(
            {
                event: "http.access",
                method: request.method,
                path: pathname,
                route: request.routeOptions?.url ?? pathname,
                statusCode: reply.statusCode,
                ...(durationMs === undefined ? {} : { durationMs }),
            },
            `HTTP request completed: ${request.method} ${pathname} -> ${reply.statusCode}${durationText}`,
        );

        if (reply.statusCode < 200 || reply.statusCode >= 300) return;
        if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
        const route = request.routeOptions.url ?? request.url;
        const match = route.match(/^\/v1\/([^/]+)/);
        if (!match) return;
        const resource = match[1]!.replace(/^me$/, "users");
        const operation =
            request.method === "POST"
                ? "create"
                : request.method === "DELETE"
                  ? "delete"
                  : "update";
        observability.recordResourceOperation(resource, operation);
    });

    app.addHook("onResponse", async (request, reply) => {
        if (reply.statusCode >= 500) {
            request.log.error(
                {
                    statusCode: reply.statusCode,
                    method: request.method,
                    url: request.url,
                },
                "HTTP request failed",
            );
        }
    });

    app.addHook("onSend", async (request, reply, payload) => {
        if (request.url.startsWith("/client/")) {
            reply.header("Cache-Control", "no-cache");
            return payload;
        }
        if (request.url === "/docs" || request.url.startsWith("/docs/")) return payload;
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("X-Frame-Options", "SAMEORIGIN");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        if (reply.statusCode >= 200 && reply.statusCode < 300) {
            const postIds = postIdsForSearchSync(request, payload);
            if (postIds.length) await syncMeilisearchPosts(postIds);

            const pathname = request.url.split("?", 1)[0] ?? "/";
            if (pathname === "/api/v1/me/preferences") {
                const session = await getSession(request);
                if (session) await syncMeilisearchUserPosts(session.user.id);
            }
            const userAction = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/(?:ban|unban)$/);
            if (userAction) await syncMeilisearchUserPosts(decodeURIComponent(userAction[1]!));

            const userRoute = pathname.match(/^\/api\/v1\/users\/([^/]+)$/);
            if (userRoute) {
                const userId = decodeURIComponent(userRoute[1]!);
                if (request.method === "DELETE") await removeMeilisearchUserPosts(userId);
                else if (["PATCH", "PUT"].includes(request.method))
                    await syncMeilisearchUserPosts(userId);
            }
        }
        const contentType = reply.getHeader("content-type");
        if (
            (request.headers.accept ?? "").includes("text/html") &&
            reply.statusCode >= 400 &&
            typeof contentType === "string" &&
            contentType.includes("application/json")
        ) {
            reply.type("text/html");
            return renderErrorPage(
                reply.statusCode,
                reply.statusCode === 404 ? "Page not found" : "Something went wrong",
                "The requested resource could not be served as HTML.",
            );
        }
        if (
            typeof contentType === "string" &&
            contentType.includes("application/json") &&
            typeof payload === "string" &&
            request.url.split("?", 1)[0]?.startsWith("/api/v1/")
        ) {
            try {
                const body = JSON.parse(payload) as Record<string, unknown>;
                body.endpoint = request.url.split("?", 1)[0] ?? "/";
                return JSON.stringify(body);
            } catch {
                // Keep the original payload when it is not a JSON object.
            }
        }
        if (
            typeof contentType !== "string" ||
            !contentType.includes("text/html") ||
            typeof payload !== "string"
        )
            return payload;
        const title = payload.match(/<title>([^<]*)<\/title>/i)?.[1] ?? config.site.name;
        const description =
            config.site.description?.trim() ||
            `${config.site.name} — self-hosted image archive and sharing server`;
        const origin = resolveRequestOrigin(config, request);
        let canonical = `${origin}${request.url.split("?", 1)[0]}`;
        const currentPath = request.url.split("?", 1)[0] ?? "/";

        let metaTitle = title;
        let metaDescription = description;
        let metaAuthor = "";
        let metaKeywords = "";
        let metaImage = "";
        let metaText: string | undefined;
        let metaFallbackHtml = "";
        let metaType: "website" | "article" = "website";
        let metaStructuredDataType: "WebSite" | "ProfilePage" | undefined =
            currentPath === "/" ? "WebSite" : undefined;
        let metaProfile: SeoProfileMetadata | undefined;
        let metaDatePublished: Date | undefined;
        let metaDateModified: Date | undefined;
        let metaAuthorUrl: string | undefined;

        let crawlerDirectives = "";

        const postMatch = currentPath.match(/^\/posts\/([^/]+)\/?$/);
        const userPermalinkMatch = currentPath.match(/^\/[^/]+\/[^/]+\/?$/);
        if (postMatch) {
            try {
                const post = await prisma.post.findFirst({
                    where: {
                        OR: [
                            { id: decodeURIComponent(postMatch[1]!) },
                            {
                                permalinkPattern: "posts",
                                permalinkKey: decodeURIComponent(postMatch[1]!),
                            },
                        ],
                        status: "published",
                        visibility: { in: ["public", "unlisted"] },
                        hiddenAt: null,
                        AND: [
                            { OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
                        ],
                    },
                    select: {
                        title: true,
                        description: true,
                        textContent: true,
                        caption: true,
                        id: true,
                        createdAt: true,
                        publishedAt: true,
                        updatedAt: true,
                        customPostId: true,
                        permalinkPattern: true,
                        permalinkIdType: true,
                        permalinkKey: true,
                        tags: { select: { tag: { select: { name: true } } } },
                        uploads: {
                            orderBy: { createdAt: "asc" },
                            take: 1,
                            select: { id: true },
                        },
                        allowSearchEngineIndex: true,
                        allowAiCrawler: true,
                        allowImageCrawler: true,
                        allowCustomCrawler: true,

                        user: {
                            select: {
                                id: true,
                                handle: true,
                                name: true,
                                isPublic: true,
                                showProfile: true,
                                isBanned: true,
                                allowSearchEngineIndex: true,
                                allowAiCrawler: true,
                                allowImageCrawler: true,
                                allowCustomCrawler: true,
                            },
                        },
                    },
                });
                if (post) {
                    canonical = `${origin}${postPermalink(post, post.user)}`;
                    metaTitle = post.title?.trim() || config.site.name;
                    metaDescription = truncateDescription(
                        post.description?.trim() ||
                            post.title?.trim() ||
                            config.site.description ||
                            config.site.name,
                    );
                    metaAuthor = post.user.name;
                    metaKeywords = post.tags.map(({ tag }) => tag.name).join(", ");
                    metaDatePublished = post.publishedAt ?? post.createdAt;
                    metaDateModified =
                        post.updatedAt > metaDatePublished ? post.updatedAt : undefined;
                    metaText =
                        post.textContent?.trim() ||
                        post.caption?.trim() ||
                        post.description?.trim() ||
                        undefined;
                    metaAuthorUrl =
                        post.user.isPublic && post.user.showProfile && !post.user.isBanned
                            ? `${origin}/users/${
                                  post.user.handle
                                      ? `@${encodeURIComponent(post.user.handle)}`
                                      : encodeURIComponent(post.user.id)
                              }/`
                            : undefined;

                    if (post.uploads[0])
                        metaImage = `${origin}/api/v1/posts/image/${encodeURIComponent(post.uploads[0].id)}/thumbnail`;

                    if (metaText || metaImage) metaType = "article";
                    metaFallbackHtml = renderPostFallback(post, metaImage || undefined);

                    crawlerDirectives = crawlerMetaContent(resolveCrawlerPolicy(post.user, post));
                }
            } catch {
                // Keep the generic site metadata when the post cannot be loaded.
            }
        } else if (currentPath.match(/^\/tags\/[^/]+\/?$/)) {
            const tagId = decodeURIComponent(currentPath.split("/")[2] ?? "");
            const tag = await prisma.tag.findUnique({
                where: { id: tagId },
                select: {
                    name: true,
                    posts: {
                        where: {
                            post: { status: "published", visibility: "public", hiddenAt: null },
                        },
                        take: 1,
                        orderBy: { post: { createdAt: "desc" } },
                        select: {
                            post: {
                                select: {
                                    uploads: {
                                        take: 1,
                                        orderBy: { createdAt: "asc" },
                                        select: { id: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (tag) {
                canonical = `${origin}${currentPath}`;
                metaTitle = `#${tag.name} · ${config.site.name}`;
                metaDescription = `Posts tagged #${tag.name} on ${config.site.name}`;
                if (tag.posts[0]?.post.uploads[0])
                    metaImage = `${origin}/api/v1/posts/image/${encodeURIComponent(tag.posts[0].post.uploads[0].id)}`;
            }
        } else if (currentPath.match(/^\/categories\/[^/]+\/?$/)) {
            const categoryId = decodeURIComponent(currentPath.split("/")[2] ?? "");
            const category = await prisma.category.findUnique({
                where: { id: categoryId },
                select: {
                    name: true,
                    description: true,
                    posts: {
                        where: { status: "published", visibility: "public", hiddenAt: null },
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: {
                            uploads: {
                                take: 1,
                                orderBy: { createdAt: "asc" },
                                select: { id: true },
                            },
                        },
                    },
                },
            });
            if (category) {
                canonical = `${origin}${currentPath}`;
                metaTitle = `${category.name} · ${config.site.name}`;
                metaDescription =
                    category.description?.trim() ||
                    `Posts in ${category.name} on ${config.site.name}`;
                if (category.posts[0]?.uploads[0])
                    metaImage = `${origin}/api/v1/posts/image/${encodeURIComponent(category.posts[0].uploads[0].id)}`;
            }
        } else if (currentPath.match(/^\/users\/[^/]+\/?$/)) {
            const userKey = decodeURIComponent(currentPath.split("/")[2] ?? "");
            const normalizedHandle = userKey.replace(/^@/, "").toLowerCase();
            const user = await prisma.user.findFirst({
                where: userKey.startsWith("@")
                    ? {
                          handle: normalizedHandle,
                          isPublic: true,
                          showProfile: true,
                          isBanned: false,
                      }
                    : {
                          OR: [{ id: userKey }, { handle: normalizedHandle }],
                          isPublic: true,
                          showProfile: true,
                          isBanned: false,
                      },
                select: {
                    id: true,
                    handle: true,
                    name: true,
                    bio: true,
                    createdAt: true,
                    updatedAt: true,
                    avatarMode: true,
                    avatarValue: true,
                    allowSearchEngineIndex: true,
                    allowAiCrawler: true,
                    allowImageCrawler: true,
                    allowCustomCrawler: true,
                },
            });
            if (user) {
                const profilePath = user.handle
                    ? `/users/@${encodeURIComponent(user.handle)}/`
                    : `/users/${encodeURIComponent(user.id)}/`;
                canonical = `${origin}${profilePath}`;
                metaTitle = user.name?.trim() || config.site.name;
                metaDescription = user.bio?.trim() || user.name?.trim() || config.site.name;
                metaImage = `${origin}/api/v1/users/${encodeURIComponent(user.id)}/avatar?v=${encodeURIComponent(user.updatedAt.toISOString())}`;
                metaStructuredDataType = "ProfilePage";
                metaProfile = {
                    name: user.name,
                    url: canonical,
                    identifier: user.id,
                    alternateName: user.handle ?? undefined,
                    description: user.bio?.trim() || undefined,
                    image: user.avatarMode === "custom" && user.avatarValue ? metaImage : undefined,
                    dateCreated: user.createdAt,
                    dateModified: user.updatedAt,
                };
                crawlerDirectives = crawlerMetaContent(resolveCrawlerPolicy(user));
            }
        } else if (userPermalinkMatch) {
            const handle = decodeURIComponent(currentPath.split("/")[1] ?? "");
            const key = decodeURIComponent(currentPath.split("/")[2] ?? "");
            const post = await prisma.post.findFirst({
                where: {
                    permalinkPattern: "user",
                    user: { OR: [{ handle }, { id: handle }] },
                    OR: [{ permalinkKey: key }, { permalinkIdType: "internalId", id: key }],
                    status: "published",
                    visibility: { in: ["public", "unlisted"] },
                    hiddenAt: null,
                    AND: [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }],
                },
                select: {
                    title: true,
                    description: true,
                    textContent: true,
                    caption: true,
                    id: true,
                    createdAt: true,
                    publishedAt: true,
                    updatedAt: true,
                    customPostId: true,
                    permalinkPattern: true,
                    permalinkIdType: true,
                    permalinkKey: true,
                    allowSearchEngineIndex: true,
                    allowAiCrawler: true,
                    allowImageCrawler: true,
                    allowCustomCrawler: true,
                    user: {
                        select: {
                            id: true,
                            handle: true,
                            name: true,
                            isPublic: true,
                            showProfile: true,
                            isBanned: true,
                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,
                        },
                    },
                    tags: { select: { tag: { select: { name: true } } } },
                    uploads: {
                        orderBy: { createdAt: "asc" },
                        take: 1,
                        select: { id: true },
                    },
                },
            });
            if (post) {
                canonical = `${origin}${currentPath}`;
                metaTitle = post.title?.trim() || config.site.name;
                metaDescription =
                    post.description?.trim() || post.title?.trim() || config.site.name;
                metaAuthor = post.user.name;
                metaKeywords = post.tags.map(({ tag }) => tag.name).join(", ");
                metaDatePublished = post.publishedAt ?? post.createdAt;
                metaDateModified = post.updatedAt > metaDatePublished ? post.updatedAt : undefined;
                metaText =
                    post.textContent?.trim() ||
                    post.caption?.trim() ||
                    post.description?.trim() ||
                    undefined;
                metaAuthorUrl =
                    post.user.isPublic && post.user.showProfile && !post.user.isBanned
                        ? `${origin}/users/${
                              post.user.handle
                                  ? `@${encodeURIComponent(post.user.handle)}`
                                  : encodeURIComponent(post.user.id)
                          }/`
                        : undefined;

                if (post.uploads[0])
                    metaImage = `${origin}/api/v1/posts/image/${encodeURIComponent(post.uploads[0].id)}/thumbnail`;

                if (metaText || metaImage) metaType = "article";
                metaFallbackHtml = renderPostFallback(post, metaImage || undefined);

                crawlerDirectives = crawlerMetaContent(resolveCrawlerPolicy(post.user, post));
            } else {
                const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
                const user = await prisma.user.findFirst({
                    where: {
                        OR: [{ handle: normalizedHandle }, { id: handle }],
                        isPublic: true,
                        showProfile: true,
                        isBanned: false,
                    },
                    select: {
                        id: true,
                        handle: true,
                        name: true,
                        bio: true,
                        createdAt: true,
                        updatedAt: true,
                        avatarMode: true,
                        avatarValue: true,
                        allowSearchEngineIndex: true,
                        allowAiCrawler: true,
                        allowImageCrawler: true,
                        allowCustomCrawler: true,
                    },
                });

                if (user) {
                    const profilePath = user.handle
                        ? `/users/@${encodeURIComponent(user.handle)}/`
                        : `/users/${encodeURIComponent(user.id)}/`;
                    canonical = `${origin}${profilePath}`;
                    metaTitle = user.name?.trim() || config.site.name;
                    metaDescription = user.bio?.trim() || user.name?.trim() || config.site.name;
                    metaImage = `${origin}/api/v1/users/${encodeURIComponent(user.id)}/avatar?v=${encodeURIComponent(user.updatedAt.toISOString())}`;
                    metaStructuredDataType = "ProfilePage";
                    metaProfile = {
                        name: user.name,
                        url: canonical,
                        identifier: user.id,
                        alternateName: user.handle ?? undefined,
                        description: user.bio?.trim() || undefined,
                        image:
                            user.avatarMode === "custom" && user.avatarValue
                                ? metaImage
                                : undefined,
                        dateCreated: user.createdAt,
                        dateModified: user.updatedAt,
                    };

                    crawlerDirectives = crawlerMetaContent(resolveCrawlerPolicy(user));
                }
            }
        }
        const tags = generateSeoMetadata({
            title: metaTitle,
            description: metaDescription,
            canonical,
            siteName: config.site.name,
            twitterSite: config.site.twitterSite,
            image: metaImage || undefined,
            imageAlt: metaTitle,
            imageWidth: metaImage.endsWith("/og") ? 1200 : undefined,
            imageHeight: metaImage.endsWith("/og") ? 630 : undefined,
            author: metaAuthor || undefined,
            authorUrl: metaAuthorUrl,
            text: metaText,
            datePublished: metaDatePublished,
            dateModified: metaDateModified,
            structuredDataType: metaStructuredDataType,
            profile: metaProfile,
            keywords: metaKeywords || undefined,
            type: metaType,
            locale: "en_US",
            crawlerDirectives,
        });

        const isReactPage = /<script type="module" src="\/client\/[^\"]+"><\/script>/i.test(
            payload,
        );
        let enhanced = payload;

        if (!enhanced.includes('property="og:title"')) {
            enhanced = enhanced.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
            enhanced = enhanced.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "");

            enhanced = enhanced.replace(/<\/head>/i, `${tags}${analyticsHead(config)}</head>`);
        } else if (crawlerDirectives) {
            enhanced = enhanced.replace(/<\/head>/i, `${crawlerDirectives}</head>`);
        }

        if (metaFallbackHtml)
            enhanced = enhanced.replace(/(<div id="post"><\/div>)/i, `${metaFallbackHtml}$1`);

        if (!isReactPage && !enhanced.includes('src="/components.js"'))
            enhanced = enhanced.replace(
                /<\/head>/i,
                '<script src="/components.js" defer></script></head>',
            );
        if (
            !enhanced.includes("googletagmanager.com/gtag/js") &&
            !enhanced.includes("googletagmanager.com/gtm.js")
        )
            enhanced = enhanced.replace(/<\/head>/i, `${analyticsHead(config)}</head>`);
        if (analyticsBody(config))
            enhanced = enhanced.replace(/<body([^>]*)>/i, `<body$1>${analyticsBody(config)}`);
        return enhanced;
    });

    await mkdir(uploadDir, { recursive: true });
    await mkdir(clientDistDir, { recursive: true });
    await app.register(cookie);
    await app.register(multipart, { limits: { fileSize: config.storage.maxFileSize } });
    await app.register(fastifyStatic, { root: publicDir, prefix: "/", decorateReply: false });
    await app.register(fastifyStatic, {
        root: clientDistDir,
        prefix: "/client/",
        decorateReply: false,
    });
    await registerOpenApi(app, config);
    await app.register(authRoutes, { prefix: "/api" });
    await app.register(apiRoutes, { prefix: "/api" });
    app.get(
        "/uploads/*",
        {
            config: {
                rateLimit: {
                    max: 12_500,
                    timeWindow: "1 minute",
                    groupId: "public-upload-reads",
                    onExceeded: () => {
                        observability.recordRateLimitHit("public_upload_read");
                    },
                },
            },
        },
        async (request, reply) => {
            const rawPath = String(
                (request.params as Record<string, unknown>)["*"] ?? "",
            ).replaceAll("\\", "/");
            if (!rawPath || rawPath.includes(".."))
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });

            const upload = await prisma.upload.findFirst({
                where: { filename: rawPath, storageArea: "uploads" },
                select: {
                    filename: true,
                    mimeType: true,
                    contentHash: true,
                    size: true,
                    user: {
                        select: {
                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,
                        },
                    },
                    post: {
                        select: {
                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,
                            user: {
                                select: {
                                    allowSearchEngineIndex: true,
                                    allowAiCrawler: true,
                                    allowImageCrawler: true,
                                    allowCustomCrawler: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!upload)
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });

            const crawlerOwner = upload.post?.user ?? upload.user;
            if (!resolveCrawlerPolicy(crawlerOwner, upload.post).image) {
                reply.header("X-Robots-Tag", "noindex");
            }

            const source = path.resolve(uploadDir, upload.filename);
            const relative = path.relative(uploadDir, source);
            if (relative.startsWith("..") || path.isAbsolute(relative))
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });

            const etag = upload.contentHash ? `"${upload.contentHash}"` : undefined;
            reply
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Length", String(upload.size));
            if (etag) {
                reply.header("ETag", etag);
                if (request.headers["if-none-match"] === etag) return reply.code(304).send();
            }
            try {
                await import("node:fs/promises").then(({ access }) => access(source));
            } catch {
                return reply
                    .code(404)
                    .send({ error: { code: "IMAGE_NOT_FOUND", message: "Image file not found." } });
            }
            reply.type(upload.mimeType);
            return reply.send(createReadStream(source));
        },
    );

    await app.register(metaRoutes);
    await app.register(federationRoutes);
    await app.register(pageRoutes);
    return app;
}
