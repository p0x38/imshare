import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";
import { userCreateSchema, userUpdateSchema } from "./schemas.js";

const publicUserSelect = {
  id: true,
  name: true,
  image: true,
  bio: true,
  websiteUrl: true,
  githubUrl: true,
  createdAt: true,
  _count: { select: { posts: true } },
} as const;

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return ok(user);
  });

  fastify.get("/v1/me/posts", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const where = { userId: user.id };
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }),
      prisma.post.count({ where }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });

  fastify.get("/v1/users", async (request) => {
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const search = typeof q.search === "string" ? q.search : undefined;
    const where = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) }, select: publicUserSelect }),
      prisma.user.count({ where }),
    ]);
    return collection(users, p.page, p.limit, total);
  });

  fastify.post("/v1/users", { schema: userCreateSchema }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = request.body as { name: string; email: string; image?: string; bio?: string; websiteUrl?: string; githubUrl?: string };
    return reply.code(201).send(ok(await prisma.user.create({ data: {
      id: randomUUID(),
      name: body.name.trim(),
      email: body.email.trim(),
      image: body.image,
      bio: body.bio?.trim() || undefined,
      websiteUrl: body.websiteUrl?.trim() || undefined,
      githubUrl: body.githubUrl?.trim() || undefined,
    } })));
  });

  fastify.get("/v1/users/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
    return ok(user);
  });

  fastify.patch("/v1/users/:userId", { schema: userUpdateSchema }, async (request, reply) => {
    const me = await requireUser(request, reply);
    if (!me) return;
    const { userId } = request.params as { userId: string };
    if (me.id !== userId) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot modify this user." } });
    const body = request.body as { name?: string; image?: string | null; bio?: string | null; websiteUrl?: string | null; githubUrl?: string | null };
    return ok(await prisma.user.update({ where: { id: userId }, data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.image !== undefined ? { image: body.image } : {}),
      ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
      ...(body.websiteUrl !== undefined ? { websiteUrl: body.websiteUrl?.trim() || null } : {}),
      ...(body.githubUrl !== undefined ? { githubUrl: body.githubUrl?.trim() || null } : {}),
    } }));
  });

  fastify.delete("/v1/users/:userId", async (request, reply) => {
    const me = await requireUser(request, reply);
    if (!me) return;
    const { userId } = request.params as { userId: string };
    if (me.id !== userId) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot delete this user." } });
    await prisma.user.delete({ where: { id: userId } });
    return reply.code(204).send();
  });

  fastify.get("/v1/users/:userId/posts", async (request) => {
    const { userId } = request.params as { userId: string };
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const where = { userId };
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }),
      prisma.post.count({ where }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });
};
