import Fastify, { LogController, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./lib/config.js";
import { renderErrorPage } from "./client/lib/error-page.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { isSameOriginRequest } from "./lib/csrf.js";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { federationRoutes } from "./routes/federation.js";
import { metaRoutes } from "./routes/meta.js";
import { pageRoutes } from "./routes/pages.js";
import { prisma } from "./lib/auth.js";
import { registerOpenApi } from "./lib/openapi.js";
import { setupObservability } from "./lib/observability.js";

const logger = process.stdout.isTTY
    ? {
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
    : true;

function escapeAttribute(value: string) {
    return value.replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
    );
}

function escapeMeta(value: string | null | undefined) {
    return escapeAttribute((value ?? "").replace(/\s+/g, " ").trim());
}

function resolveRequestOrigin(
    config: Awaited<ReturnType<typeof loadConfig>>,
    request: FastifyRequest,
) {
    const configuredOrigin = config.auth.baseUrl?.trim();
    if (configuredOrigin) {
        try {
            return new URL(configuredOrigin).origin;
        } catch {
            // Fall back to the request origin when the configured base URL is invalid.
        }
    }
    return `${request.protocol}://${request.hostname}`;
}

function analyticsHead(config: Awaited<ReturnType<typeof loadConfig>>): string {
    const gaId = config.analytics?.googleAnalyticsMeasurementId?.trim();
    const gtmId = config.analytics?.googleTagManagerContainerId?.trim();
    const parts: string[] = [];
    if (gaId) {
        const id = escapeAttribute(gaId);
        parts.push(
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>`,
        );
    }
    if (gtmId) {
        const id = escapeAttribute(gtmId);
        parts.push(
            `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`,
        );
    }
    return parts.join("");
}

function analyticsBody(config: Awaited<ReturnType<typeof loadConfig>>): string {
    const gtmId = config.analytics?.googleTagManagerContainerId?.trim();
    if (!gtmId) return "";
    return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}

export async function buildApp() {
    const config = await loadConfig();
    const app = Fastify({
        logger,
        logController: new LogController({ disableRequestLogging: true }),
    });
    const viewLimiter = new RateLimiter(75, 60_000);
    const uploadLimiter = new RateLimiter(30, 86_400_000);
    const rateLimitingEnabled = process.env.NODE_ENV !== "test";
    const rootDir = process.cwd();
    const publicDir = path.join(rootDir, "public");
    const clientDistDir = path.join(rootDir, "dist", "client");
    const uploadDir = path.resolve(rootDir, config.storage.uploadDirectory);
    const observability = setupObservability(app, config.observability);

    app.addHook("onRequest", async (request, reply) => {
        const key = request.ip || "unknown";
        const requestOrigin = resolveRequestOrigin(config, request);
        if (
            !isSameOriginRequest(
                request.method,
                requestOrigin,
                request.headers.origin,
                request.headers.referer,
            )
        )
            return reply
                .code(403)
                .send({
                    error: {
                        code: "CSRF_ORIGIN_REJECTED",
                        message: "The request origin is not allowed.",
                    },
                });
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (request.method === "POST" && pathname === "/api/v1/uploads") {
            const result = uploadLimiter.consume(key);
            reply
                .header("X-RateLimit-Limit", "30")
                .header("X-RateLimit-Remaining", String(result.remaining));
            if (rateLimitingEnabled && !result.allowed)
                return reply
                    .code(429)
                    .header("Retry-After", String(result.retryAfter))
                    .send({
                        error: {
                            code: "UPLOAD_RATE_LIMITED",
                            message: "Upload limit exceeded. Try again later.",
                        },
                    });
            return;
        }
        if (
            request.method === "GET" &&
            pathname.startsWith("/api/v1/") &&
            !pathname.startsWith("/api/v1/health") &&
            !pathname.startsWith("/api/v1/ready")
        ) {
            const result = viewLimiter.consume(key);
            reply
                .header("X-RateLimit-Limit", "75")
                .header("X-RateLimit-Remaining", String(result.remaining));
            if (rateLimitingEnabled && !result.allowed)
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
        viewLimiter.prune();
        uploadLimiter.prune();
    });

    app.addHook("onSend", async (request, reply, payload) => {
        if (request.url === "/docs" || request.url.startsWith("/docs/")) return payload;
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("X-Frame-Options", "SAMEORIGIN");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
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
        const description = `${config.site.name} — self-hosted image archive and sharing server`;
        const origin = `${request.protocol}://${request.hostname}`;
        const canonical = `${origin}${request.url.split("?", 1)[0]}`;
        let metaTitle = title;
        let metaDescription = description;
        let metaAuthor = "";
        let metaKeywords = "";
        let metaImage = "";
        let metaType = "website";
        const postMatch = request.url.split("?", 1)[0]?.match(/^\/posts\/([^/]+)\/?$/);
        if (postMatch) {
            try {
                const post = await prisma.post.findUnique({
                    where: { id: decodeURIComponent(postMatch[1]!) },
                    select: {
                        title: true,
                        description: true,
                        user: { select: { name: true } },
                        tags: { select: { tag: { select: { name: true } } } },
                        uploads: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
                    },
                });
                if (post) {
                    metaTitle = `${post.title} · ${config.site.name}`;
                    metaDescription = `${post.description?.trim() || post.title} · ${config.site.name} — self-hosted image archive and sharing server`;
                    metaAuthor = post.user.name;
                    metaKeywords = post.tags.map(({ tag }) => tag.name).join(", ");
                    if (post.uploads[0])
                        metaImage = `${origin}/api/v1/posts/image/${encodeURIComponent(post.uploads[0].id)}`;
                    metaType = "article";
                }
            } catch {
                // Keep the generic site metadata when the post cannot be loaded.
            }
        }
        const tags = [
            `<meta name="description" content="${escapeMeta(metaDescription)}">`,
            metaAuthor ? `<meta name="author" content="${escapeMeta(metaAuthor)}">` : "",
            `<meta name="generator" content="${escapeAttribute(config.site.name)}">`,
            metaKeywords ? `<meta name="keywords" content="${escapeMeta(metaKeywords)}">` : "",
            `<meta property="og:type" content="${escapeAttribute(metaType)}">`,
            `<meta property="og:site_name" content="${escapeAttribute(config.site.name)}">`,
            `<meta property="og:title" content="${escapeMeta(metaTitle)}">`,
            `<meta property="og:description" content="${escapeMeta(metaDescription)}">`,
            `<meta property="og:url" content="${escapeAttribute(canonical)}">`,
            metaImage ? `<meta property="og:image" content="${escapeAttribute(metaImage)}">` : "",
            metaImage
                ? `<meta property="og:image:secure_url" content="${escapeAttribute(metaImage)}">`
                : "",
            `<link rel="canonical" href="${escapeAttribute(canonical)}">`,
        ].join("");
        const isReactPage = /<script type="module" src="\/client\/[^\"]+"><\/script>/i.test(
            payload,
        );
        let enhanced = payload.includes('property="og:title"')
            ? payload
            : payload.replace(/<\/head>/i, `${tags}${analyticsHead(config)}</head>`);
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
    await app.register(metaRoutes);
    await app.register(federationRoutes);
    await app.register(pageRoutes);
    return app;
}
