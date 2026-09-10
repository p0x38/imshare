import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { getSession, ok, requireUser } from "../lib/api.js";
import { broadcastPostReaction } from "../lib/realtime.js";

const TYPES = ["like", "favorite", "save"] as const;
type ReactionType = (typeof TYPES)[number];

function isReactionType(value: string): value is ReactionType {
  return (TYPES as readonly string[]).includes(value);
}

async function reactionState(postId: string, userId?: string) {
  const grouped = await prisma.postReaction.groupBy({
    by: ["type"],
    where: { postId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(
    TYPES.map((type) => [type, grouped.find((item) => item.type === type)?._count._all ?? 0]),
  );
  const active: Record<string, boolean> = Object.fromEntries(TYPES.map((type) => [type, false]));
  if (userId) {
    const rows = await prisma.postReaction.findMany({
      where: { userId, postId, type: { in: [...TYPES] } },
      select: { type: true },
    });
    for (const row of rows) active[row.type] = true;
  }
  return { counts, active };
}

export const reactionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/posts/:postId/reactions", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    const session = await getSession(request);
    return ok(await reactionState(postId, session?.user.id));
  });

  fastify.put("/v1/posts/:postId/:type", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId, type } = request.params as { postId: string; type: string };
    if (!isReactionType(type)) return reply.code(400).send({ error: { code: "INVALID_REACTION", message: "Supported reactions are like, favorite, and save." } });
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    await prisma.postReaction.upsert({
      where: { userId_postId_type: { userId: user.id, postId, type } },
      update: {},
      create: { userId: user.id, postId, type },
    });
    const state = await reactionState(postId, user.id);
    broadcastPostReaction({ postId, type, active: true, counts: state.counts });
    return ok(state);
  });

  fastify.delete("/v1/posts/:postId/:type", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { postId, type } = request.params as { postId: string; type: string };
    if (!isReactionType(type)) return reply.code(400).send({ error: { code: "INVALID_REACTION", message: "Supported reactions are like, favorite, and save." } });
    await prisma.postReaction.deleteMany({ where: { userId: user.id, postId, type } });
    const state = await reactionState(postId, user.id);
    broadcastPostReaction({ postId, type, active: false, counts: state.counts });
    return ok(state);
  });
};
