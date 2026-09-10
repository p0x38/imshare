import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";

const REASONS = ["spam", "copyright", "harassment", "illegal", "sexual", "violence", "other"] as const;

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/v1/reports", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const body = request.body as { reason?: string; details?: string; postId?: string; commentId?: string };
    if (!body.reason || !REASONS.includes(body.reason as (typeof REASONS)[number])) return reply.code(400).send({ error: { code: "INVALID_REPORT_REASON", message: "Invalid report reason." } });
    if (!body.postId && !body.commentId) return reply.code(400).send({ error: { code: "REPORT_TARGET_REQUIRED", message: "A postId or commentId is required." } });
    if (body.postId && body.commentId) return reply.code(400).send({ error: { code: "MULTIPLE_REPORT_TARGETS", message: "Report one target at a time." } });
    if (body.details && body.details.length > 2000) return reply.code(400).send({ error: { code: "INVALID_REPORT_DETAILS", message: "Report details are limited to 2000 characters." } });
    if (body.postId && !(await prisma.post.findUnique({ where: { id: body.postId }, select: { id: true } }))) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
    if (body.commentId && !(await prisma.comment.findUnique({ where: { id: body.commentId }, select: { id: true } }))) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "Comment not found." } });
    const existing = await prisma.report.findFirst({ where: { reporterId: user.id, postId: body.postId, commentId: body.commentId, status: "open" } });
    if (existing) return reply.code(409).send({ error: { code: "REPORT_EXISTS", message: "You already have an open report for this item." } });
    const report = await prisma.report.create({ data: { reason: body.reason, details: body.details?.trim() || undefined, reporterId: user.id, postId: body.postId, commentId: body.commentId } });
    return reply.code(201).send(ok({ id: report.id, status: report.status }));
  });
};
