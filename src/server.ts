import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";

import { authRoutes } from "./routes/auth.js";
import { artRoutes } from "./routes/art.js";
import { prisma } from "./lib/auth.js";

const app = Fastify({
  logger: true,
});

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(rootDir, "uploads");

await app.register(cookie);

await app.register(multipart, {
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

await app.register(fastifyStatic, {
  root: uploadDir,
  prefix: "/art/",
  decorateReply: false,
});

await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/",
  decorateReply: true,
});

await app.register(authRoutes);
await app.register(artRoutes);

app.get("/", async (_request, reply) => {
  return reply.sendFile("index.html");
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (reply.sent) {
    return;
  }

  return reply.code(500).send({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? undefined
        : error.message,
  });
});

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({
    host: "0.0.0.0",
    port: 3000,
  });

  app.log.info("Art server listening on http://0.0.0.0:3000");
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}