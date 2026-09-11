import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyFormbody from "@fastify/formbody";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import EJS from "ejs";
import path from "node:path";

import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { healthRoutes } from "./routes/health.js";
import { loadConfig } from "./lib/config.js";
import { createRateLimiter } from "./lib/rate-limit.js";
import { verifyCsrf } from "./lib/csrf.js";

export async function buildApp() {
    const config = await loadConfig();
    const app = Fastify({ logger: true });
    const viewLimiter = createRateLimiter(75, 60_000);
    const uploadLimiter = createRateLimiter(30, 86_400_000);

    await app.register(fastifyCookie);
    await app.register(fastifyCors, { origin: config.security.corsOrigin, credentials: true });
    await app.register(fastifyFormbody);
    await app.register(fastifyMultipart, { limits: { fileSize: config.storage.maxFileSize } });
    await app.register(fastifyStatic, {
        root: path.resolve(process.cwd(), "public"),
        prefix: "/",
    });
    await app.register(fastifyView, { engine: { ejs: EJS }, root: path.resolve(process.cwd(), "views") });

    app.addHook("onSend", async (request, reply) => {
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("X-Frame-Options", "SAMEORIGIN");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    });

    app.addHook("preValidation", async (request, reply) => {
        if (!verifyCsrf(request))
            return reply.code(403).send({ error: { code: "CSRF_INVALID", message: "Invalid CSRF origin." } });
    });

    app.addHook("onRequest", async (request, reply) => {
        const key = request.ip;
        if (request.method === "POST" && request.url.split("?", 1)[0] === "/v1/uploads") {
            const result = uploadLimiter.consume(key);
            reply.header("X-RateLimit-Limit", "30").header("X-RateLimit-Remaining", String(result.remaining));
            if (!result.allowed)
                return reply.code(429).header("Retry-After", String(result.retryAfter)).send({ error: { code: "UPLOAD_RATE_LIMITED", message: "Upload limit exceeded. Try again later." } });
            return;
        }
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (request.method === "GET" && pathname.startsWith("/v1/") && !pathname.startsWith("/v1/health") && !pathname.startsWith("/v1/ready")) {
            const result = viewLimiter.consume(key);
            reply.header("X-RateLimit-Limit", "75").header("X-RateLimit-Remaining", String(result.remaining));
            if (!result.allowed)
                return reply.code(429).header("Retry-After", String(result.retryAfter)).send({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } });
        }
    });

    await app.register(healthRoutes);
    await app.register(authRoutes);
    await app.register(apiRoutes);

    return app;
}
