import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/categories", async (request) => {
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const [items, total] = await Promise.all([
      prisma.category.findMany({ skip: p.skip, take: p.limit, orderBy: { name: parseOrder(q.order) }, include: { _count: { select: { posts: true } } } }),
      prisma.category.count(),
    ]);
    return collection(items, p.page, p.limit, total);
  });

  fastify.post("/v1/categories", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return reply.code(201).send(ok(await prisma.category.create({ data: request.body as { name: string; slug: string; description?: string } })));
  });

  fastify.get("/v1/categories/:categoryId", async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { _count: { select: { posts: true } } } });
    if (!category) return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." } });
    return ok(category);
  });

  fastify.patch("/v1/categories/:categoryId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { categoryId } = request.params as { categoryId: string };
    try {
      return ok(await prisma.category.update({ where: { id: categoryId }, data: request.body as { name?: string; slug?: string; description?: string } }));
    } catch {
      return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." } });
    }
  });

  fastify.delete("/v1/categories/:categoryId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { categoryId } = request.params as { categoryId: string };
    try {
      await prisma.category.delete({ where: { id: categoryId } });
    } catch {
      return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." } });
    }
    return reply.code(204).send();
  });

  fastify.get("/v1/categories/:categoryId/posts", async (request) => {
    const { categoryId } = request.params as { categoryId: string };
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const where = { categoryId };
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }),
      prisma.post.count({ where }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });
};
