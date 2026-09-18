import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { getSession, ok, requireUser } from "../lib/api.js";
import { openapi, parameter } from "../lib/openapi-route.js";
import { userBadges } from "../lib/user-badges.js";

const publicPostWhere = { status: "published", visibility: "public", hiddenAt: null, OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] };
function avatarUrl(userId: string, updatedAt: Date) { return `/v1/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(updatedAt.toISOString())}`; }
async function resolveUser(value: string) { if (value.startsWith("@")) return prisma.user.findFirst({ where: { handle: value.slice(1).trim().toLowerCase() } }); return prisma.user.findUnique({ where: { id: value } }); }

const userId = parameter.path("userId", { type: "string" }, { description: "User ID or @handle." });
const pagination = [parameter.query("page", { type: "integer", minimum: 1, default: 1 }), parameter.query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 })];

async function visibleRelationshipUser(userId: string, relation: "followers" | "following") {
    const user = await resolveUser(userId);
    if (!user || !user.showProfile || user.isBanned) return null;
    return { user, visible: relation === "followers" ? user.showFollowers : user.showFollowings };
}

function publicFollowUser(user: { id: string; name: string; handle: string | null; image: string | null; role: string; badgesJson: string | null; createdAt: Date; updatedAt: Date }) {
    return { id: user.id, name: user.name, handle: user.handle, image: user.image, avatarUrl: avatarUrl(user.id, user.updatedAt), badges: userBadges(user) };
}

export const followRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/users/:userId/profile", { schema: openapi({ tags: "Users", summary: "Get a user profile", description: "Returns a public profile and follow state when visible to the requester.", operationId: "getUserProfile", parameters: [userId], security: [{}, { cookieAuth: [] }], responses: { "200": { description: "User profile." }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => {
        const { userId } = request.params as { userId: string }; const user = await resolveUser(userId);
        if (!user || !user.showProfile || user.isBanned) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        const session = await getSession(request);
        const [posts, followers, following, follow] = await Promise.all([
            user.showPosts ? prisma.post.count({ where: { userId: user.id, ...publicPostWhere } }) : Promise.resolve(0),
            user.showFollowers ? prisma.follow.count({ where: { followingId: user.id, status: "approved" } }) : Promise.resolve(null),
            user.showFollowings ? prisma.follow.count({ where: { followerId: user.id, status: "approved" } }) : Promise.resolve(null),
            session && session.user.id !== user.id ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: session.user.id, followingId: user.id } }, select: { status: true } }) : Promise.resolve(null),
        ]);
        return ok({ id: user.id, name: user.name, handle: user.showHandle ? user.handle : null, badges: userBadges(user), bio: user.bio, websiteUrl: user.websiteUrl, githubUrl: user.githubUrl, avatarUrl: avatarUrl(user.id, user.updatedAt), profileBannerUrl: user.profileBannerUrl, accentColor: user.accentColor, createdAt: user.createdAt, allowSearchEngineIndex: user.allowSearchEngineIndex, profileLinks: await prisma.profileLink.findMany({ where: { userId: user.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }), stats: { posts, followers, following }, followStatus: follow?.status ?? null, isFollowing: follow?.status === "approved", canFollow: Boolean(session && session.user.id !== user.id && user.isPublic) });
    });

    fastify.get("/v1/users/:userId/followers", { schema: openapi({ tags: "Follows", summary: "List a user's followers", description: "Lists approved followers when the profile owner allows followers to be visible.", operationId: "listUserFollowers", parameters: [userId, ...pagination], security: [{}, { cookieAuth: [] }], responses: { "200": { description: "Follower collection." }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => {
        const { userId: value } = request.params as { userId: string }; const result = await visibleRelationshipUser(value, "followers");
        if (!result) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (!result.visible) return reply.code(403).send({ error: { code: "FOLLOWERS_HIDDEN", message: "This user does not allow others to see their followers." } });
        const q = request.query as Record<string, unknown>; const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Math.max(1, Number(q.limit) || 20)); const [items, total] = await Promise.all([prisma.follow.findMany({ where: { followingId: result.user.id, status: "approved" }, include: { follower: { select: { id: true, name: true, handle: true, image: true, role: true, badgesJson: true, createdAt: true, updatedAt: true } } }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }), prisma.follow.count({ where: { followingId: result.user.id, status: "approved" } })]);
        return { data: items.map((item) => publicFollowUser(item.follower)), page, limit, total, totalPages: Math.ceil(total / limit) };
    });

    fastify.get("/v1/users/:userId/following", { schema: openapi({ tags: "Follows", summary: "List users followed by a user", description: "Lists approved following relationships when the profile owner allows following lists to be visible.", operationId: "listUserFollowing", parameters: [userId, ...pagination], security: [{}, { cookieAuth: [] }], responses: { "200": { description: "Following collection." }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => {
        const { userId: value } = request.params as { userId: string }; const result = await visibleRelationshipUser(value, "following");
        if (!result) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
        if (!result.visible) return reply.code(403).send({ error: { code: "FOLLOWING_HIDDEN", message: "This user does not allow others to see who they follow." } });
        const q = request.query as Record<string, unknown>; const page = Math.max(1, Number(q.page) || 1); const limit = Math.min(100, Math.max(1, Number(q.limit) || 20)); const [items, total] = await Promise.all([prisma.follow.findMany({ where: { followerId: result.user.id, status: "approved" }, include: { following: { select: { id: true, name: true, handle: true, image: true, role: true, badgesJson: true, createdAt: true, updatedAt: true } } }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }), prisma.follow.count({ where: { followerId: result.user.id, status: "approved" } })]);
        return { data: items.map((item) => publicFollowUser(item.following)), page, limit, total, totalPages: Math.ceil(total / limit) };
    });

    fastify.post("/v1/users/:userId/follow", { schema: openapi({ tags: "Follows", summary: "Follow a user", description: "Creates a follow relationship or follow request for the authenticated user.", operationId: "followUser", parameters: [userId], security: [{ cookieAuth: [] }], responses: { "200": { description: "Follow state." }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => {
        const me = await requireUser(request, reply); if (!me) return; const { userId: value } = request.params as { userId: string }; const target = await resolveUser(value);
        if (!target || !target.showProfile || target.isBanned) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } }); if (target.id === me.id) return reply.code(400).send({ error: { code: "CANNOT_FOLLOW_SELF", message: "You cannot follow yourself." } }); if (!target.isPublic) return reply.code(403).send({ error: { code: "PROFILE_PRIVATE", message: "This profile does not accept follows." } });
        const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: target.id } }, select: { status: true } }); if (existing) return ok({ following: existing.status === "approved", status: existing.status }); const status = target.followApprovalRequired ? "pending" : "approved"; await prisma.follow.create({ data: { followerId: me.id, followingId: target.id, status } }); return ok({ following: status === "approved", status });
    });
    fastify.delete("/v1/users/:userId/follow", { schema: openapi({ tags: "Follows", summary: "Unfollow a user", description: "Removes the authenticated user's follow relationship with a user.", operationId: "unfollowUser", parameters: [userId], security: [{ cookieAuth: [] }], responses: { "200": { description: "Follow state after removal." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => { const me = await requireUser(request, reply); if (!me) return; const { userId: value } = request.params as { userId: string }; const target = await resolveUser(value); if (!target) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } }); await prisma.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } }); return ok({ following: false }); });
    fastify.get("/v1/me/follow-requests", { schema: openapi({ tags: "Follows", summary: "List follow requests", description: "Lists pending follow requests received by the authenticated user.", operationId: "listFollowRequests", security: [{ cookieAuth: [] }], responses: { "200": { description: "Pending follow requests." }, "401": { $ref: "#/components/responses/Unauthorized" } } }) }, async (request, reply) => { const me = await requireUser(request, reply); if (!me) return; const requests = await prisma.follow.findMany({ where: { followingId: me.id, status: "pending" }, orderBy: { createdAt: "desc" }, include: { follower: { select: { id: true, name: true, handle: true, image: true, createdAt: true } } } }); return ok(requests); });
    fastify.post("/v1/me/follow-requests/:userId/approve", { schema: openapi({ tags: "Follows", summary: "Approve a follow request", description: "Approves a pending follow request from a user.", operationId: "approveFollowRequest", parameters: [userId], security: [{ cookieAuth: [] }], responses: { "200": { description: "Request approved." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => { const me = await requireUser(request, reply); if (!me) return; const { userId: value } = request.params as { userId: string }; const result = await prisma.follow.updateMany({ where: { followerId: value, followingId: me.id, status: "pending" }, data: { status: "approved" } }); if (!result.count) return reply.code(404).send({ error: { code: "FOLLOW_REQUEST_NOT_FOUND", message: "Follow request not found." } }); return ok({ approved: true }); });
    fastify.delete("/v1/me/follow-requests/:userId", { schema: openapi({ tags: "Follows", summary: "Reject a follow request", description: "Rejects a pending follow request from a user.", operationId: "rejectFollowRequest", parameters: [userId], security: [{ cookieAuth: [] }], responses: { "200": { description: "Request rejected." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => { const me = await requireUser(request, reply); if (!me) return; const { userId: value } = request.params as { userId: string }; const result = await prisma.follow.deleteMany({ where: { followerId: value, followingId: me.id, status: "pending" } }); if (!result.count) return reply.code(404).send({ error: { code: "FOLLOW_REQUEST_NOT_FOUND", message: "Follow request not found." } }); return ok({ rejected: true }); });
};
