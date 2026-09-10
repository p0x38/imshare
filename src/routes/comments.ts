import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, ok, parsePagination, requireUser } from "../lib/api.js";
import { createNotification } from "../lib/notifications.js";

function view(comment: any) {
  return { id: comment.id, body: comment.body, createdAt: comment.createdAt, updatedAt: comment.updatedAt, author: { ...comment.user, avatarUrl: `/v1/users/${encodeURIComponent(comment.user.id)}/avatar` } };
}

export const commentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/posts/:postId/comments", async (request) => {
    const { postId } = request.params as { postId: string }; const q = request.query as Record<string, unknown>; const p = parsePagination(q); const where = { postId };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({ where, include: { user: { select: { id: true, name: true, avatarMode: true, avatarValue: true, updatedAt: true } } }, skip: p.skip, take: p.limit, orderBy: { createdAt: "asc" } }),
      prisma.comment.count({ where }),
    ]);
    return collection(comments.map(view), p.page, p.limit, total);
  });
  fastify.post("/v1/posts/:postId/comments", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { postId } = request.params as { postId: string }; const text = (request.body as { body?: string }).body?.trim() ?? "";
    if (!text || text.length > 5000) return reply.code(400).send({ error: { code: "INVALID_COMMENT", message: "Comment must contain 1–5000 characters." } });
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true, title: true } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    const comment = await prisma.comment.create({ data: { body: text, userId: user.id, postId }, include: { user: { select: { id: true, name: true, avatarMode: true, avatarValue: true, updatedAt: true } } } });
    await createNotification({ recipientId: post.userId, actorId: user.id, type: "comment", message: `${user.name} commented on ${post.title}`, postId, commentId: comment.id });
    return reply.code(201).send(ok(view(comment)));
  });
  fastify.patch("/v1/comments/:commentId", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return; const { commentId } = request.params as { commentId: string };
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    if (comment.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this comment." } });
    const text = (request.body as { body?: string }).body?.trim() ?? "";
    if (!text || text.length > 5000) return reply.code(400).send({ error: { code: "INVALID_COMMENT", message: "Comment must contain 1–5000 characters." } });
    const updated = await prisma.comment.update({ where: { id: commentId }, data: { body: text }, include: { user: { select: { id: true, name: true, avatarMode: true, avatarValue: true, updatedAt: true } } } });
    return ok(view(updated));
  });
  fastify.delete("/v1/comments/:commentId", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return; const { commentId } = request.params as { commentId: string };
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    if (comment.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this comment." } });
    await prisma.comment.delete({ where: { id: commentId } }); return reply.code(204).send();
  });
};
