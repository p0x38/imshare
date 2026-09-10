import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth.js";

function toWebRequest(
  request: Parameters<NonNullable<FastifyPluginAsync>["handler"]>[0],
): Request {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else {
      headers.set(key, value);
    }
  }

  const protocol =
    headers.get("x-forwarded-proto") ??
    "http";

  const host =
    headers.get("x-forwarded-host") ??
    headers.get("host") ??
    "localhost:3000";

  const url = `${protocol}://${host}${request.raw.url ?? "/"}`;

  const method = request.method.toUpperCase();

  let body: BodyInit | undefined;

  if (method !== "GET" && method !== "HEAD") {
    if (request.body !== undefined) {
      if (
        typeof request.body === "string" ||
        request.body instanceof Uint8Array
      ) {
        body = request.body;
      } else {
        body = JSON.stringify(request.body);

        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
      }
    }
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    url: "/api/auth/*",
    handler: async (request, reply) => {
      const webRequest = toWebRequest(request);

      const response = await auth.handler(webRequest);

      reply.code(response.status);

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const contentType = response.headers.get("content-type");

      if (
        contentType?.includes("application/json") ||
        contentType?.includes("text/")
      ) {
        return reply.send(await response.text());
      }

      return reply.send(Buffer.from(await response.arrayBuffer()));
    },
  });
};