import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { collection, getSession, parsePagination } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

export const recommendationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/recommendations", async (request) => {
    const session = await getSession(request);
    const q = request.query as Record<string, unknown>;
    const p = parsePagination(q);
    let preferredTagIds: string[] = [];
    let preferredCategoryIds: string[] = [];
    let excludedIds: string[] = [];
    if (session?.user.id) {
      const [reactions, ownPosts] = await Promise.all([
        prisma.postReaction.findMany({ where: { userId: session.user.id }, select: { post: { select: { id: true, categoryId: true, tags: { select: { tagId: true } } } } } }),
        prisma.post.findMany({ where: { userId: session.user.id }, select: { id: true } }),
      ]);
      excludedIds = ownPosts.map((post) => post.id);
      preferredCategoryIds = [...new Set(reactions.map((row) => row.post.categoryId).filter((id): id is string => Boolean(id)))];
      preferredTagIds = [...new Set(reactions.flatMap((row) => row.post.tags.map((tag) => tag.tagId)))];
    }
    const where = {
      id: { notIn: excludedIds },
      ...(preferredCategoryIds.length || preferredTagIds.length ? { OR: [
        ...(preferredCategoryIds.length ? [{ categoryId: { in: preferredCategoryIds } }] : []),
        ...(preferredTagIds.length ? [{ tags: { some: { tagId: { in: preferredTagIds } } } }] : []),
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" } }),
      prisma.post.count({ where }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });
};
