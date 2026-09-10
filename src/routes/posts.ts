import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { findTags, postInclude, postView } from "./_shared.js";

export const postRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/posts", async (request) => {
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const where: Record<string, unknown> = {};
    if (typeof q.user === "string") where.userId = q.user;
    if (typeof q.category === "string") where.categoryId = q.category;
    if (typeof q.tag === "string") where.tags = { some: { tag: { slug: q.tag } } };
    if (typeof q.search === "string") where.OR = [{ title: { contains: q.search } }, { description: { contains: q.search } }];
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where: where as never, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }),
      prisma.post.count({ where: where as never }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });

  fastify.post("/v1/posts", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = request.body as { title?: string; description?: string; sourceUrl?: string; tags?: string[]; categoryId?: string | null; uploadIds?: string[] };
    if (!body.title?.trim()) return reply.code(400).send({ error: { code: "INVALID_POST", message: "title is required." } });

    const uploadIds = [...new Set(body.uploadIds ?? [])];
    if (uploadIds.length > 0) {
      const ownedUploads = await prisma.upload.count({ where: { id: { in: uploadIds }, userId: user.id, postId: null } });
      if (ownedUploads !== uploadIds.length) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You can only attach your own unused uploads." } });
      }
    }

    const tags = await findTags(body.tags ?? []);
    const post = await prisma.post.create({
      data: {
        title: body.title.trim(), description: body.description, sourceUrl: body.sourceUrl,
        categoryId: body.categoryId, userId: user.id,
        tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
        uploads: uploadIds.length ? { connect: uploadIds.map((id) => ({ id })) } : undefined,
      },
      include: postInclude,
    });
    return reply.code(201).send(ok(postView(post)));
  });

  fastify.get("/v1/posts/:postId", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    return ok(postView(post));
  });

  fastify.patch("/v1/posts/:postId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId } = request.params as { postId: string };
    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (existing.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    const body = request.body as { title?: string; description?: string; sourceUrl?: string | null; categoryId?: string | null; tags?: string[] };
    if (body.tags) await prisma.postTag.deleteMany({ where: { postId } });
    const tags = body.tags ? await findTags(body.tags) : [];
    const post = await prisma.post.update({
      where: { id: postId },
      data: { title: body.title, description: body.description, sourceUrl: body.sourceUrl, categoryId: body.categoryId, ...(body.tags ? { tags: { create: tags.map((tag) => ({ tagId: tag.id })) } } : {}) },
      include: postInclude,
    });
    return ok(postView(post));
  });

  fastify.delete("/v1/posts/:postId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId } = request.params as { postId: string };
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    await prisma.post.delete({ where: { id: postId } });
    return reply.code(204).send();
  });

  fastify.get("/v1/posts/:postId/tags", async (request) => {
    const { postId } = request.params as { postId: string };
    return ok(await prisma.postTag.findMany({ where: { postId }, include: { tag: true } }).then((items) => items.map((item) => item.tag)));
  });

  fastify.post("/v1/posts/:postId/tags", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId } = request.params as { postId: string };
    const body = request.body as { tagId?: string };
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    if (!body.tagId) return reply.code(400).send({ error: { code: "INVALID_TAG", message: "tagId is required." } });
    const relation = await prisma.postTag.upsert({ where: { postId_tagId: { postId, tagId: body.tagId } }, update: {}, create: { postId, tagId: body.tagId }, include: { tag: true } });
    return reply.code(201).send(ok(relation.tag));
  });

  fastify.delete("/v1/posts/:postId/tags/:tagId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId, tagId } = request.params as { postId: string; tagId: string };
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    await prisma.postTag.delete({ where: { postId_tagId: { postId, tagId } } }).catch(() => undefined);
    return reply.code(204).send();
  });

  fastify.get("/v1/posts/:postId/category", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { category: true } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    return ok(post.category);
  });

  fastify.put("/v1/posts/:postId/category", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId } = request.params as { postId: string };
    const body = request.body as { categoryId?: string };
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    const updated = await prisma.post.update({ where: { id: postId }, data: { categoryId: body.categoryId }, include: { category: true } });
    return ok(updated.category);
  });

  fastify.delete("/v1/posts/:postId/category", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId } = request.params as { postId: string };
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    await prisma.post.update({ where: { id: postId }, data: { categoryId: null } });
    return reply.code(204).send();
  });
};
