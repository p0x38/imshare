import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

export const tagRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/tags", async (request) => {
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const where = typeof q.search === "string" ? { name: { contains: q.search } } : {};
    const [items, total] = await Promise.all([
      prisma.tag.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: parseOrder(q.order) }, include: { _count: { select: { posts: true } } } }),
      prisma.tag.count({ where }),
    ]);
    return collection(items, p.page, p.limit, total);
  });

  fastify.post("/v1/tags", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = request.body as { name?: string; slug?: string };
    if (!body.name || !body.slug) return reply.code(400).send({ error: { code: "INVALID_TAG", message: "name and slug are required." } });
    return reply.code(201).send(ok(await prisma.tag.create({ data: { name: body.name, slug: body.slug } })));
  });

  fastify.get("/v1/tags/:tagId", async (request, reply) => {
    const { tagId } = request.params as { tagId: string };
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { _count: { select: { posts: true } } } });
    if (!tag) return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } });
    return ok(tag);
  });

  fastify.patch("/v1/tags/:tagId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { tagId } = request.params as { tagId: string };
    try {
      return ok(await prisma.tag.update({ where: { id: tagId }, data: request.body as { name?: string; slug?: string } }));
    } catch {
      return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } });
    }
  });

  fastify.delete("/v1/tags/:tagId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { tagId } = request.params as { tagId: string };
    try {
      await prisma.tag.delete({ where: { id: tagId } });
    } catch {
      return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } });
    }
    return reply.code(204).send();
  });

  fastify.get("/v1/tags/:tagId/posts", async (request) => {
    const { tagId } = request.params as { tagId: string };
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const where = { tags: { some: { tagId } } };
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }),
      prisma.post.count({ where }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });
};
