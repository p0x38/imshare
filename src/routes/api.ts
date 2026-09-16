import type { FastifyPluginAsync } from "fastify";
import { accountRoutes } from "./account.js";
import { registerAdminRoutes } from "./admin.js";
import { categoryRoutes } from "./categories.js";
import { commentRoutes } from "./comments.js";
import { emojiRoutes } from "./emojis.js";
import { followRoutes } from "./follows.js";
import { healthRoutes } from "./health.js";
import { imageRoutes } from "./images.js";
import { notificationRoutes } from "./notifications.js";
import { permalinkRoutes } from "./permalinks.js";
import { postLifecycleRoutes } from "./post-lifecycle.js";
import { postRoutes } from "./posts.js";
import { profileLinkRoutes } from "./profile-links.js";
import { reactionRoutes } from "./reactions.js";
import { recommendationRoutes } from "./recommendations.js";
import { reportRoutes } from "./reports.js";
import { searchRoutes } from "./search.js";
import { tagRoutes } from "./tags.js";
import { textRoutes } from "./texts.js";
import { uploadRoutes } from "./uploads.js";
import { userRoutes } from "./users.js";
import { avatarRoutes } from "./avatars.js";
import { prisma } from "../lib/auth.js";
import { getSession } from "../lib/api.js";
import { installOpenApiRouteDefaults } from "../lib/openapi-route-defaults.js";

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
    installOpenApiRouteDefaults(fastify);
    await fastify.register(accountRoutes);
    fastify.addHook("preHandler", async (request) => {
        if (request.method !== "POST" || request.url.split("?", 1)[0] !== "/v1/posts") return;
        const session = await getSession(request);
        if (!session || !request.body || typeof request.body !== "object") return;
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { defaultCategoryId: true, defaultPostVisibility: true, defaultAllowDownload: true, defaultContentWarning: true },
        });
        if (!user) return;
        const body = request.body as Record<string, unknown>;
        if (body.categoryId === undefined) body.categoryId = user.defaultCategoryId;
        if (body.visibility === undefined) body.visibility = user.defaultPostVisibility;
        if (body.allowDownload === undefined) body.allowDownload = user.defaultAllowDownload;
        if (body.contentWarning === undefined) body.contentWarning = user.defaultContentWarning;
    });
    await fastify.register(healthRoutes);
    await fastify.register(userRoutes);
    await fastify.register(postRoutes);
    await fastify.register(textRoutes);
    await fastify.register(permalinkRoutes);
    await fastify.register(postLifecycleRoutes);
    await fastify.register(reactionRoutes);
    await fastify.register(commentRoutes);
    await fastify.register(notificationRoutes);
    await fastify.register(profileLinkRoutes);
    await fastify.register(avatarRoutes);
    await fastify.register(followRoutes);
    await fastify.register(tagRoutes);
    await fastify.register(categoryRoutes);
    await fastify.register(searchRoutes);
    await fastify.register(uploadRoutes);
    await fastify.register(imageRoutes);
    await fastify.register(reportRoutes);
    await fastify.register(recommendationRoutes);
    await fastify.register(emojiRoutes);
    await fastify.register(registerAdminRoutes);
};
