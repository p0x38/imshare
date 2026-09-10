import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, parseOrder, parsePagination } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/search", async (request) => {
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const term = typeof q.q === "string" ? q.q : "";
    const type = typeof q.type === "string" ? q.type : "all";
    const order = parseOrder(q.order);
    const result: Record<string, unknown> = {};
    let total = 0;

    if (type === "posts" || type === "all") {
      const where: Record<string, unknown> = term ? { OR: [{ title: { contains: term } }, { description: { contains: term } }] } : {};
      if (typeof q.user === "string") where.userId = q.user;
      if (typeof q.category === "string") where.categoryId = q.category;
      if (typeof q.tag === "string") where.tags = { some: { tag: { slug: q.tag } } };
      const [items, count] = await Promise.all([
        prisma.post.findMany({ where: where as never, skip: p.skip, take: p.limit, orderBy: { createdAt: order }, include: postInclude }),
        prisma.post.count({ where: where as never }),
      ]);
      result.posts = items.map(postView);
      total += count;
      if (type === "posts") return collection(items.map(postView), p.page, p.limit, count);
    }

    if (type === "users" || type === "all") {
      const where = term ? { name: { contains: term } } : {};
      const [items, count] = await Promise.all([
        prisma.user.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: order }, select: { id: true, name: true, image: true, createdAt: true } }),
        prisma.user.count({ where }),
      ]);
      result.users = items;
      total += count;
      if (type === "users") return collection(items, p.page, p.limit, count);
    }

    if (type === "tags" || type === "all") {
      const where = term ? { name: { contains: term } } : {};
      const [items, count] = await Promise.all([
        prisma.tag.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: order } }),
        prisma.tag.count({ where }),
      ]);
      result.tags = items;
      total += count;
      if (type === "tags") return collection(items, p.page, p.limit, count);
    }

    if (type === "categories" || type === "all") {
      const where = term ? { name: { contains: term } } : {};
      const [items, count] = await Promise.all([
        prisma.category.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: order } }),
        prisma.category.count({ where }),
      ]);
      result.categories = items;
      total += count;
      if (type === "categories") return collection(items, p.page, p.limit, count);
    }

    return {
      data: result,
      pagination: {
        page: p.page,
        limit: p.limit,
        total,
        totalPages: Math.ceil(total / p.limit),
      },
    };
  });
};
