import Fastify, { LogController, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./lib/config.js";
import { renderTemplate } from "./lib/template.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
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
    const uploadDir = path.resolve(rootDir, config.storage.uploadDirectory);
    app.addHook("onRequest", async (request, reply) => {
        const key = request.ip || "unknown";
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
        if (request.method === "GET" && !request.url.startsWith("/v1/health")) {
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

        const postMatch = request.url.split("?", 1)[0].match(/^\/posts\/([^/]+)\/?$/);
        if (postMatch) {
            try {
                const post = await prisma.post.findUnique({
                    where: { id: decodeURIComponent(postMatch[1]) },
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
        let enhanced = payload.includes('property="og:title"')
            ? payload
            : payload.replace(/<\/head>/i, `${tags}</head>`);
        if (!enhanced.includes('src="/components.js"'))
            enhanced = enhanced.replace(
                /<\/head>/i,
                '<script src="/components.js" defer></script></head>',
            );
        return enhanced;
    });
    await mkdir(uploadDir, { recursive: true });
    await app.register(cookie);
    await app.register(multipart, { limits: { fileSize: config.storage.maxFileSize, files: 20 } });
    await app.register(authRoutes);
    await app.register(apiRoutes);
    await app.register(fastifyStatic, {
        root: uploadDir,
        prefix: "/uploads/",
        decorateReply: false,
    });
    await app.register(fastifyStatic, { root: publicDir, prefix: "/", decorateReply: true });
    const sendPage = (file: string) => async (_request: FastifyRequest, reply: FastifyReply) =>
        reply.type("text/html").send(await readFile(path.join(publicDir, file), "utf8"));
    app.get("/", sendPage("index.html"));
    app.get("/posts/", sendPage("posts/index.html"));
    app.get("/posts/:postId", sendPage("posts/view.html"));
    app.get("/users/", sendPage("users/index.html"));
    app.get("/users/:userId", sendPage("users/view.html"));
    app.get("/users/:userId/posts", sendPage("users/posts.html"));
    app.get("/tags/", sendPage("tags/index.html"));
    app.get("/tags/:tagId", sendPage("tags/view.html"));
    app.get("/tags/:tagId/posts", sendPage("tags/posts.html"));
    app.get("/categories/", sendPage("categories/index.html"));
    app.get("/categories/:categoryId", sendPage("categories/view.html"));
    app.get("/categories/:categoryId/posts", sendPage("categories/posts.html"));
    app.get("/search/", sendPage("search/index.html"));
    app.get("/account/", sendPage("account/index.html"));
    app.get("/account/login/", sendPage("account/login/index.html"));
    app.get("/account/register/", sendPage("account/register/index.html"));
    app.get("/notifications/", sendPage("account/notifications.html"));
    app.get("/account/profile/", sendPage("account/profile.html"));
    app.get("/account/logout/", async (request, reply) => {
        const response = await fetch(`${request.protocol}://${request.hostname}/v1/auth/sign-out`, {
            method: "POST",
            headers: { cookie: request.headers.cookie ?? "" },
        });
        response.headers.forEach((value, key) => reply.header(key, value));
        return reply.redirect("/");
    });
    app.get("/dashboard/", sendPage("dashboard/index.html"));
    app.get("/dashboard/posts/", sendPage("dashboard/posts/index.html"));
    app.get("/dashboard/posts/new/", sendPage("posts/new/index.html"));
    app.get("/dashboard/posts/:postId/", sendPage("dashboard/posts/view.html"));
    app.get("/dashboard/posts/:postId/edit/", sendPage("dashboard/posts/edit.html"));
    app.get("/dashboard/tags/", sendPage("dashboard/tags.html"));
    app.get("/dashboard/categories/", sendPage("dashboard/categories.html"));
    app.get("/dashboard/settings/", sendPage("dashboard/settings.html"));
    app.get("/about/", sendPage("about.html"));
    app.get("/faq/", sendPage("faq.html"));
    app.get("/github/", sendPage("github.html"));
    app.get("/privacy/", sendPage("privacy.html"));
    app.get("/terms/", sendPage("terms.html"));
    app.setNotFoundHandler(async (request, reply) => {
        if ((request.headers.accept ?? "").includes("text/html"))
            return sendErrorPage(
                404,
                "Page not found",
                "The page you requested does not exist.",
                reply,
            );
        return reply
            .code(404)
            .send({
                error: {
                    code: "NOT_FOUND",
                    message: "The requested page or resource was not found.",
                },
            });
    });
    app.setErrorHandler(async (error, request, reply) => {
        request.log.error(error);
        if (reply.sent) return;
        const errorObject = typeof error === "object" && error !== null ? error : undefined;
        const statusCode =
            errorObject && "statusCode" in errorObject && typeof errorObject.statusCode === "number"
                ? errorObject.statusCode
                : 500;
        const status = statusCode >= 400 ? statusCode : 500;
        const message =
            error instanceof Error
                ? error.message
                : errorObject && "message" in errorObject && typeof errorObject.message === "string"
                  ? errorObject.message
                  : "Something went wrong while processing your request.";
        const code =
            errorObject && "code" in errorObject && typeof errorObject.code === "string"
                ? errorObject.code
                : "INTERNAL_ERROR";
        const publicMessage =
            status < 500 ? message : "Something went wrong while processing your request.";
        if ((request.headers.accept ?? "").includes("text/html"))
            return sendErrorPage(
                status,
                status === 404 ? "Page not found" : "Something went wrong",
                publicMessage,
                reply,
            );
        return reply.code(status).send({ error: { code, message: publicMessage } });
    });
    return app;
}
