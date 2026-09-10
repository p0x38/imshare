import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { ok, parsePagination } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/search", async (request) => {
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const term = typeof q.q === "string" ? q.q : "";
    const type = typeof q.type === "string" ? q.type : "all";
    const result: Record<string, unknown> = {};

    if (type === "posts" || type === "all") {
      result.posts = (await prisma.post.findMany({
        where: term ? { OR: [{ title: { contains: term } }, { description: { contains: term } }] } : {},
        take: p.limit,
        include: postInclude,
      })).map(postView);
    }
    if (type === "users" || type === "all") {
      result.users = await prisma.user.findMany({
        where: term ? { name: { contains: term } } : {},
        take: p.limit,
        select: { id: true, name: true, image: true },
      });
    }
    if (type === "tags" || type === "all") {
      result.tags = await prisma.tag.findMany({ where: term ? { name: { contains: term } } : {}, take: p.limit });
    }
    if (type === "categories" || type === "all") {
      result.categories = await prisma.category.findMany({ where: term ? { name: { contains: term } } : {}, take: p.limit });
    }

    return ok(result);
  });
};
