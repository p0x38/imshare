import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { getSession, ok, requireUser } from "../lib/api.js";

const publicPostWhere = {
    status: "published",
    visibility: "public",
    hiddenAt: null,
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
};
function avatarUrl(userId: string, updatedAt: Date) { return `/v1/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(updatedAt.toISOString())}`; }
async function resolveUser(value: string) { if (value.startsWith("@")) return prisma.user.findFirst({ where: { handle: value.slice(1).trim().toLowerCase() } }); return prisma.user.findUnique({ where: { id: value } }); }

export const followRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/users/:userId/profile", async (request, reply) => {
        const { userId } = request.params as { userId: string };
        const user = await resolveUser(userId);
        if (!user || !user.showProfile || user.isBanned) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        const session = await getSession(request);
        const [posts, followers, following, isFollowing] = await Promise.all([
            user.showPosts ? prisma.post.count({ where: { userId: user.id, ...publicPostWhere } }) : Promise.resolve(0),
            user.showFollowers ? prisma.follow.count({ where: { followingId: user.id } }) : Promise.resolve(null),
            user.showFollowings ? prisma.follow.count({ where: { followerId: user.id } }) : Promise.resolve(null),
            session && session.user.id !== user.id ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } }, select: { followerId: true } }) : Promise.resolve(null),
        ]);
        return ok({
            id: user.id, name: user.name, handle: user.showHandle ? user.handle : null, bio: user.bio,
            websiteUrl: user.websiteUrl, githubUrl: user.githubUrl, avatarUrl: avatarUrl(user.id, user.updatedAt),
            profileBannerUrl: user.profileBannerUrl, accentColor: user.accentColor, createdAt: user.createdAt,
            allowSearchEngineIndex: user.allowSearchEngineIndex,
            profileLinks: await prisma.profileLink.findMany({ where: { userId: user.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
            stats: { posts, followers, following }, isFollowing: Boolean(isFollowing), canFollow: Boolean(session && session.user.id !== user.id && user.isPublic),
        });
    });
    fastify.post("/v1/users/:userId/follow", async (request, reply) => {
        const me = await requireUser(request, reply); if (!me) return;
        const { userId } = request.params as { userId: string }; const target = await resolveUser(userId);
        if (!target || !target.showProfile || target.isBanned) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (target.id === me.id) return reply.code(400).send({ error: { code: "CANNOT_FOLLOW_SELF", message: "You cannot follow yourself." } });
        if (!target.isPublic) return reply.code(403).send({ error: { code: "PROFILE_PRIVATE", message: "This profile does not accept follows." } });
        await prisma.follow.upsert({ where: { followerId_followingId: { followerId: me.id, followingId: target.id } }, create: { followerId: me.id, followingId: target.id }, update: {} });
        return ok({ following: true });
    });
    fastify.delete("/v1/users/:userId/follow", async (request, reply) => {
        const me = await requireUser(request, reply); if (!me) return;
        const { userId } = request.params as { userId: string }; const target = await resolveUser(userId);
        if (!target) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        await prisma.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } });
        return ok({ following: false });
    });
};
