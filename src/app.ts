import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "./lib/config.js";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";

const logger = process.stdout.isTTY ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l", ignore: "pid,hostname", singleLine: true } } } : true;

export async function buildApp() {
  const config = await loadConfig();
  const app = Fastify({ logger, disableRequestLogging: false });
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, "public");
  const uploadDir = path.resolve(rootDir, config.storage.uploadDirectory);
  await mkdir(uploadDir, { recursive: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: config.storage.maxFileSize, files: 20 } });
  await app.register(authRoutes);
  await app.register(apiRoutes);
  await app.register(fastifyStatic, { root: uploadDir, prefix: "/uploads/", decorateReply: false });
  await app.register(fastifyStatic, { root: publicDir, prefix: "/", decorateReply: true });
  const sendPage = (file: string) => async (_request: FastifyRequest, reply: FastifyReply) => reply.sendFile(file);
  app.get("/", sendPage("index.html"));
  app.get("/posts/", sendPage("posts/index.html")); app.get("/posts/:postId", sendPage("posts/view.html"));
  app.get("/users/", sendPage("users/index.html")); app.get("/users/:userId", sendPage("users/view.html")); app.get("/users/:userId/posts", sendPage("users/posts.html"));
  app.get("/tags/", sendPage("tags/index.html")); app.get("/tags/:tagId", sendPage("tags/view.html")); app.get("/tags/:tagId/posts", sendPage("tags/posts.html"));
  app.get("/categories/", sendPage("categories/index.html")); app.get("/categories/:categoryId", sendPage("categories/view.html")); app.get("/categories/:categoryId/posts", sendPage("categories/posts.html"));
  app.get("/search/", sendPage("search/index.html")); app.get("/account/", sendPage("account/index.html"));
  app.get("/account/login/", sendPage("account/login/index.html")); app.get("/account/register/", sendPage("account/register/index.html"));
  app.get("/account/logout/", async (request, reply) => { const response = await fetch(`${request.protocol}://${request.hostname}/v1/auth/sign-out`, { method: "POST", headers: { cookie: request.headers.cookie ?? "" } }); response.headers.forEach((value, key) => reply.header(key, value)); return reply.redirect("/"); });
  app.get("/dashboard/", sendPage("dashboard/index.html")); app.get("/dashboard/posts/", sendPage("dashboard/posts/index.html")); app.get("/dashboard/posts/new/", sendPage("posts/new/index.html")); app.get("/dashboard/posts/:postId/", sendPage("dashboard/posts/view.html")); app.get("/dashboard/posts/:postId/edit/", sendPage("dashboard/posts/edit.html")); app.get("/dashboard/tags/", sendPage("dashboard/tags.html")); app.get("/dashboard/categories/", sendPage("dashboard/categories.html")); app.get("/dashboard/settings/", sendPage("dashboard/settings.html"));
  app.get("/about/", sendPage("about.html")); app.get("/privacy/", sendPage("privacy.html")); app.get("/terms/", sendPage("terms.html"));
  app.setErrorHandler((error, request, reply) => { request.log.error(error); if (reply.sent) return; return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error." } }); });
  return app;
}
