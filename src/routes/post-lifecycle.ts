import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";
import { hasRole, type UserRole } from "../lib/permissions.js";
import { postUpdateSchema } from "./schemas.js";

const statuses = new Set(["draft", "published"]);
const visibilities = new Set(["public", "unlisted", "private"]);

async function canModerate(userId: string): Promise<boolean> {
    const record = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return Boolean(record && hasRole(record.role as UserRole, "moderator"));
}

function canView(post: { userId: string; status: string; visibility: string; scheduledAt: Date | null; hiddenAt: Date | null }, userId?: string): boolean {
    if (post.userId === userId) return true;
    if (post.hiddenAt) return false;
    if (post.status !== "published") return false;
    if (post.scheduledAt && post.scheduledAt > new Date()) return false;
    return post.visibility !== "private";
}

export const postLifecycleRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.patch("/v1/posts/:postId/lifecycle", { schema: postUpdateSchema }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const body = request.body as {
            status?: string;
            visibility?: string;
            scheduledAt?: string | null;
            contentWarning?: string | null;
        };
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
        if (body.status !== undefined && !statuses.has(body.status))
            return reply.code(400).send({ error: { code: "INVALID_STATUS", message: "Invalid post status." } });
        if (body.visibility !== undefined && !visibilities.has(body.visibility))
            return reply.code(400).send({ error: { code: "INVALID_VISIBILITY", message: "Invalid post visibility." } });
        const scheduledAt = body.scheduledAt === undefined ? post.scheduledAt : body.scheduledAt ? new Date(body.scheduledAt) : null;
        if (scheduledAt && Number.isNaN(scheduledAt.getTime()))
            return reply.code(400).send({ error: { code: "INVALID_SCHEDULE", message: "scheduledAt must be a valid ISO date." } });
        const status = body.status ?? post.status;
        const publishedAt = status === "published" && !scheduledAt ? post.publishedAt ?? new Date() : post.publishedAt;
        const updated = await prisma.post.update({
            where: { id: postId },
            data: {
                status,
                visibility: body.visibility ?? post.visibility,
                scheduledAt,
                publishedAt,
                contentWarning: body.contentWarning === undefined ? post.contentWarning : body.contentWarning,
                hiddenAt: status === "published" ? null : post.hiddenAt,
            },
        });
        return ok(updated);
    });

    fastify.post("/v1/posts/:postId/publish", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
        const updated = await prisma.post.update({
            where: { id: postId },
            data: { status: "published", scheduledAt: null, publishedAt: post.publishedAt ?? new Date(), hiddenAt: null },
        });
        return ok(updated);
    });

    fastify.post("/v1/posts/:postId/hide", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id && !(await canModerate(user.id)))
            return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot hide this post." } });
        const updated = await prisma.post.update({ where: { id: postId }, data: { hiddenAt: new Date() } });
        return ok(updated);
    });

    fastify.post("/v1/posts/:postId/unhide", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id && !(await canModerate(user.id)))
            return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot unhide this post." } });
        const updated = await prisma.post.update({ where: { id: postId }, data: { hiddenAt: null } });
        return ok(updated);
    });

    fastify.get("/v1/posts/:postId/revisions", async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
        if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        if (post.userId !== user.id && !(await canModerate(user.id)))
            return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot view these revisions." } });
        return ok(await prisma.postRevision.findMany({ where: { postId }, orderBy: { createdAt: "desc" } }));
    });

    fastify.get("/v1/posts/:postId/visibility", async (request, reply) => {
        const { postId } = request.params as { postId: string };
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post || !canView(post)) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
        return ok({ status: post.status, visibility: post.visibility, publishedAt: post.publishedAt, scheduledAt: post.scheduledAt, contentWarning: post.contentWarning });
    });
};
