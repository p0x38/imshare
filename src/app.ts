import Fastify, { LogController, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./lib/config.js";
import { renderTemplate } from "./lib/template.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { isSameOriginRequest } from "./lib/csrf.js";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { pageRoutes } from "./routes/pages.js";
import { prisma } from "./lib/auth.js";

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

export async function buildApp() {
    const config = await loadConfig();
    const app = Fastify({
        logger,
        logController: new LogController({ disableRequestLogging: true }),
    });
    const viewLimiter = new RateLimiter(75, 60_000);
    const uploadLimiter = new RateLimiter(30, 86_400_000);
    const rootDir = process.cwd();
    const publicDir = path.join(rootDir, "public");
    const clientDistDir = path.join(rootDir, "dist", "client");
    const viewsDir = path.join(rootDir, "views");
    const uploadDir = path.resolve(rootDir, config.storage.uploadDirectory);

    app.addHook("onRequest", async (request, reply) => {
        const key = request.ip || "unknown";
        const hostHeader = request.headers.host;
        const host = hostHeader?.trim() || request.hostname;
        const configuredHost = host.includes(":") ? host : `${host}:${config.server.port}`;
        if (
            !isSameOriginRequest(
                request.method,
                `${request.protocol}://${configuredHost}`,
                request.headers.origin,
                request.headers.referer,
            )
        )
            return reply.code(403).send({
                error: {
                    code: "CSRF_ORIGIN_REJECTED",
                    message: "The request origin is not allowed.",
                },
            });
        if (request.method === "POST" && request.url.split("?", 1)[0] === "/v1/uploads") {
            const result = uploadLimiter.consume(key);
            reply
                .header("X-RateLimit-Limit", "30")
                .header("X-RateLimit-Remaining", String(result.remaining));
            if (!result.allowed)
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
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (request.method === "GET" && pathname.startsWith("/v1/") && !pathname.startsWith("/v1/health") && !pathname.startsWith("/v1/ready")) {
            const result = viewLimiter.consume(key);
            reply
                .header("X-RateLimit-Limit", "75")
                .header("X-RateLimit-Remaining", String(result.remaining));
            if (!result.allowed)
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

    const errorPage = async (status: number, fallbackTitle: string, message: string) => {
        const file = path.join(publicDir, "errors", `${status}.html`);
        try {
            return await readFile(file, "utf8");
        } catch {
            return await renderTemplate("error.html", { status, title: fallbackTitle, message });
        }
    };

    const sendErrorPage = async (
        status: number,
        fallbackTitle: string,
        message: string,
        reply: FastifyReply,
    ) =>
        reply
            .code(status)
            .type("text/html")
            .send(await errorPage(status, fallbackTitle, message));

    app.addHook("onSend", async (request, reply, payload) => {
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
            return errorPage(
                reply.statusCode,
                reply.statusCode === 404 ? "Page not found" : "Something went wrong",
                "The requested resource could not be served as HTML.",
            );
        }
        if (
            typeof contentType === "string" &&
            contentType.includes("application/json") &&
            typeof payload === "string" &&
            request.url.split("?", 1)[0]?.startsWith("/v1/")
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
                        metaImage = `${origin}/v1/posts/image/${encodeURIComponent(post.uploads[0].id)}`;
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
        const isReactPage = /<script type="module" src="\/client\/[^\"]+"><\/script>/i.test(payload);
        let enhanced = payload.includes('property="og:title"')
            ? payload
            : payload.replace(/<\/head>/i, `${tags}</head>`);
        if (!isReactPage && !enhanced.includes('src="/components.js"'))
            enhanced = enhanced.replace(
                /<\/head>/i,
                '<script src="/components.js" defer></script></head>',
            );
        return enhanced;
    });

    await mkdir(uploadDir, { recursive: true });
    await mkdir(clientDistDir, { recursive: true });
    await app.register(cookie);
    await app.register(multipart, { limits: { fileSize: config.storage.maxFileSize } });
    await app.register(fastifyStatic, {
        root: publicDir,
        prefix: "/",
        decorateReply: false,
    });
    await app.register(fastifyStatic, {
        root: clientDistDir,
        prefix: "/client/",
        decorateReply: false,
    });
    await app.register(fastifyView, {
        engine: { ejs },
        root: viewsDir,
        includeViewExtension: true,
    });

    const sendPage = async (request: FastifyRequest, reply: FastifyReply, view: string) => {
        try {
            return await reply.view(view);
        } catch (error) {
            request.log.error({ err: error, view }, "Failed to render page");
            return sendErrorPage(500, "Server error", "The requested page could not be rendered.", reply);
        }
    };

    await app.register(authRoutes);
    await app.register(apiRoutes);
    await app.register(pageRoutes);

    app.get("/", async (request, reply) => sendPage(request, reply, "index.ejs"));
    app.get("/login/", async (request, reply) => sendPage(request, reply, "auth/login.ejs"));
    app.get("/signup/", async (request, reply) => sendPage(request, reply, "auth/signup.ejs"));
    app.get("/account/", async (request, reply) => sendPage(request, reply, "account/index.ejs"));
    app.get("/account/notifications/", async (request, reply) => sendPage(request, reply, "account/notifications.ejs"));
    app.get("/account/sessions/", async (request, reply) => sendPage(request, reply, "account/sessions.ejs"));
    app.get("/account/profile/", async (request, reply) => sendPage(request, reply, "account/profile.ejs"));
    app.get("/posts/", async (request, reply) => sendPage(request, reply, "posts/index.ejs"));
    app.get("/posts/new/", async (request, reply) => sendPage(request, reply, "posts/new.ejs"));
    app.get("/posts/:postId", async (request, reply) => sendPage(request, reply, "posts/view.ejs"));
    app.get("/posts/:postId/", async (request, reply) => sendPage(request, reply, "posts/view.ejs"));
    app.get("/dashboard/", async (request, reply) => sendPage(request, reply, "dashboard/index.ejs"));
    app.get("/dashboard/posts/", async (request, reply) => sendPage(request, reply, "dashboard/posts.ejs"));
    app.get("/dashboard/posts/:postId/", async (request, reply) => sendPage(request, reply, "dashboard/post.ejs"));
    app.get("/dashboard/posts/:postId/edit/", async (request, reply) => sendPage(request, reply, "dashboard/post-editor.ejs"));
    app.get("/dashboard/tags/", async (request, reply) => sendPage(request, reply, "dashboard/tags.ejs"));
    app.get("/dashboard/categories/", async (request, reply) => sendPage(request, reply, "dashboard/categories.ejs"));
    app.get("/dashboard/settings/", async (request, reply) => sendPage(request, reply, "dashboard/settings.ejs"));

    return app;
}
