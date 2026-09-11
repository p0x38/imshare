import { mkdir } from "node:fs/promises";
import path from "node:path";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import { registerAuthRoutes } from "./auth-routes.js";
import { getConfig } from "./config.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerPageRoutes } from "./routes/pages.js";
import { isSameOriginRequest } from "./lib/csrf.js";
import { RateLimiter } from "./lib/rate-limit.js";

const config = getConfig();

export async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({
        logger: true,
    });

    const uploadDir = path.resolve(config.storage.uploadDirectory);
    const publicDir = path.resolve("public");
    const viewsDir = path.resolve("views");

    await mkdir(uploadDir, { recursive: true });
    await app.register(cookie);
    await app.register(multipart, { limits: { fileSize: config.storage.maxFileSize } });
    await app.register(fastifyStatic, {
        root: publicDir,
        prefix: "/",
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
        } catch {
            return reply.code(500).send({
                statusCode: 500,
                code: "VIEW_RENDER_ERROR",
                error: "Internal Server Error",
                message: "The requested page could not be rendered.",
            });
        }
    };

    await registerAuthRoutes(app);
    await registerApiRoutes(app);
    await registerMetaRoutes(app);
    await registerPageRoutes(app, sendPage);

    return app;
}
