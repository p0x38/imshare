import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, ok, parsePagination, requireUser } from "../lib/api.js";
import { createNotification } from "../lib/notifications.js";

const commentUserSelect = { id: true, name: true, avatarMode: true, avatarValue: true, updatedAt: true } as const;

function view(comment: any) {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: { ...comment.user, avatarUrl: `/v1/users/${encodeURIComponent(comment.user.id)}/avatar` },
    likes: comment.reactions?._count?._all ?? comment._count?.reactions ?? 0,
    liked: Boolean(comment.reactions?.some?.((reaction: any) => reaction.userId)),
  };
}

async function commentView(id: string, userId?: string) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { user: { select: commentUserSelect }, _count: { select: { reactions: true } } },
  });
  if (!comment) return null;
  const liked = userId ? Boolean(await prisma.commentReaction.findUnique({ where: { userId_commentId_type: { userId, commentId: id, type: "like" } } })) : false;
  return { ...view(comment), liked };
}

export const commentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/posts/:postId/comments", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    const session = await getSession(request);
    const where = { postId };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({ where, include: { user: { select: commentUserSelect }, _count: { select: { reactions: true } } }, skip: p.skip, take: p.limit, orderBy: { createdAt: "asc" } }),
      prisma.comment.count({ where }),
    ]);
    const liked = session?.user.id ? new Set((await prisma.commentReaction.findMany({ where: { userId: session.user.id, commentId: { in: comments.map((c) => c.id) }, type: "like" }, select: { commentId: true } })).map((x) => x.commentId)) : new Set<string>();
    return collection(comments.map((comment) => ({ ...view(comment), liked: liked.has(comment.id) })), p.page, p.limit, total);
  });

  fastify.post("/v1/posts/:postId/comments", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { postId } = request.params as { postId: string };
    const text = (request.body as { body?: string }).body?.trim() ?? "";
    if (!text || text.length > 5000) return reply.code(400).send({ error: { code: "INVALID_COMMENT", message: "Comment must contain 1–5000 characters." } });
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true, title: true } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    const comment = await prisma.comment.create({ data: { body: text, userId: user.id, postId }, include: { user: { select: commentUserSelect }, _count: { select: { reactions: true } } } });
    if (post.userId !== user.id) await createNotification({ recipientId: post.userId, actorId: user.id, type: "comment", message: `${user.name} commented on ${post.title}`, postId, commentId: comment.id });
    return reply.code(201).send(ok({ ...view(comment), liked: false }));
  });

  fastify.patch("/v1/comments/:commentId", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { commentId } = request.params as { commentId: string };
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { post: { select: { userId: true } } } });
    if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    if (comment.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this comment." } });
    const text = (request.body as { body?: string }).body?.trim() ?? "";
    if (!text || text.length > 5000) return reply.code(400).send({ error: { code: "INVALID_COMMENT", message: "Comment must contain 1–5000 characters." } });
    return ok(await commentView((await prisma.comment.update({ where: { id: commentId }, data: { body: text } })).id, user.id));
  });

  fastify.delete("/v1/comments/:commentId", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { commentId } = request.params as { commentId: string };
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { post: { select: { userId: true } } } });
    if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    if (comment.userId !== user.id && comment.post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot remove this comment." } });
    await prisma.comment.delete({ where: { id: commentId } });
    return reply.code(204).send();
  });

  fastify.put("/v1/comments/:commentId/like", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { commentId } = request.params as { commentId: string };
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    await prisma.commentReaction.upsert({ where: { userId_commentId_type: { userId: user.id, commentId, type: "like" } }, update: {}, create: { userId: user.id, commentId, type: "like" } });
    return ok(await commentView(commentId, user.id));
  });

  fastify.delete("/v1/comments/:commentId/like", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { commentId } = request.params as { commentId: string };
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    await prisma.commentReaction.deleteMany({ where: { userId: user.id, commentId, type: "like" } });
    return ok(await commentView(commentId, user.id));
  });
};
