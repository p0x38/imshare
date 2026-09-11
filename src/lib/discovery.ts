import { prisma } from "./auth.js";

export function publicPostWhere(extra: Record<string, unknown> = {}) {
    return {
        status: "published",
        visibility: "public",
        hiddenAt: null,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        user: { isPublic: true, showPosts: true, showProfile: true },
        ...extra,
    } as never;
}

export async function postReactionScore(postId: string): Promise<number> {
    const [reactions, comments] = await Promise.all([
        prisma.postReaction.count({ where: { postId } }),
        prisma.comment.count({ where: { postId } }),
    ]);
    return reactions * 3 + comments;
}
