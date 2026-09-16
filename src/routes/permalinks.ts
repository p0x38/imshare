import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { getSession, ok } from "../lib/api.js";
import { postInclude, postView } from "./_shared.js";

export const permalinkRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/posts/permalink/:key", async (request, reply) => {
        const { key } = request.params as { key: string };
        const session = await getSession(request);
        const post = await prisma.post.findUnique({
            where: { permalinkKey: decodeURIComponent(key) },
            include: postInclude,
        });
        if (!post)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        const owner = post.userId === session?.user.id;
        const publicVisible =
            post.status === "published" &&
            post.visibility === "public" &&
            !post.hiddenAt &&
            (!post.scheduledAt || post.scheduledAt <= new Date());
        const unlistedVisible =
            post.status === "published" &&
            post.visibility === "unlisted" &&
            !post.hiddenAt &&
            (!post.scheduledAt || post.scheduledAt <= new Date());
        if (!owner && !publicVisible && !unlistedVisible)
            return reply
                .code(404)
                .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        return ok(postView(post));
    });
};
