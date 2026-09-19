import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { getSession, ok, requireUser } from "../lib/api.js";
import { createNotification } from "../lib/notifications.js";
import { broadcastPostReaction } from "../lib/realtime.js";
import { openapi, parameter } from "../lib/openapi-route.js";

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

const postId = parameter.path("postId", { type: "string" }, { description: "Post ID." });
const reactionType = parameter.path(
    "type",
    { type: "string", enum: [...TYPES] },
    { description: "Reaction type." },
);
const stateResponse = {
    description: "Current reaction counts and the authenticated user's active reactions.",
};

export const reactionRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/v1/posts/:postId/reactions",
        {
            schema: openapi({
                tags: "Reactions",
                summary: "Get post reactions",
                description:
                    "Returns reaction counts and, when authenticated, the current user's active reactions.",
                operationId: "getPostReactions",
                parameters: [postId],
                responses: {
                    "200": stateResponse,
                    "404": { $ref: "#/components/responses/NotFound" },
                },
                security: [{}, { cookieAuth: [] }],
                responseExamples: {
                    "200": {
                        data: {
                            counts: { like: 12, favorite: 3, save: 7 },
                            active: { like: false, favorite: true, save: false },
                        },
                    },
                    "404": { error: { code: "POST_NOT_FOUND", message: "Post not found." } },
                },
            }),
        },
        async (request, reply) => {
            const { postId } = request.params as { postId: string };
            const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { id: true },
            });
            if (!post)
                return reply
                    .code(404)
                    .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
            const session = await getSession(request);
            return ok(await reactionState(postId, session?.user.id));
        },
    );

    fastify.put(
        "/v1/posts/:postId/:type",
        {
            schema: openapi({
                tags: "Reactions",
                summary: "Add post reaction",
                description:
                    "Activates one of the supported reactions for the authenticated user. The operation is idempotent.",
                operationId: "addPostReaction",
                parameters: [postId, reactionType],
                responses: {
                    "200": stateResponse,
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
                responseExamples: {
                    "200": {
                        data: {
                            counts: { like: 13, favorite: 3, save: 7 },
                            active: { like: true, favorite: false, save: false },
                        },
                    },
                    "400": {
                        error: {
                            code: "INVALID_REACTION",
                            message: "Supported reactions are like, favorite, and save.",
                        },
                    },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { postId, type } = request.params as { postId: string; type: string };
            if (!isReactionType(type))
                return reply
                    .code(400)
                    .send({
                        error: {
                            code: "INVALID_REACTION",
                            message: "Supported reactions are like, favorite, and save.",
                        },
                    });
            const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { id: true, userId: true, title: true },
            });
            if (!post)
                return reply
                    .code(404)
                    .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
            await prisma.postReaction.upsert({
                where: { userId_postId_type: { userId: user.id, postId, type } },
                update: {},
                create: { userId: user.id, postId, type },
            });
            const state = await reactionState(postId, user.id);
            await createNotification({
                recipientId: post.userId,
                actorId: user.id,
                type: "reaction",
                message: `${user.name} reacted to ${post.title}`,
                postId,
                reactionType: type,
            });
            broadcastPostReaction({ postId, type, active: true, counts: state.counts });
            return ok(state);
        },
    );

    fastify.delete(
        "/v1/posts/:postId/:type",
        {
            schema: openapi({
                tags: "Reactions",
                summary: "Remove post reaction",
                description:
                    "Removes the selected reaction for the authenticated user. The operation is idempotent.",
                operationId: "removePostReaction",
                parameters: [postId, reactionType],
                responses: {
                    "200": stateResponse,
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
                responseExamples: {
                    "200": {
                        data: {
                            counts: { like: 12, favorite: 3, save: 7 },
                            active: { like: false, favorite: false, save: false },
                        },
                    },
                    "404": { error: { code: "POST_NOT_FOUND", message: "Post not found." } },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { postId, type } = request.params as { postId: string; type: string };
            if (!isReactionType(type))
                return reply
                    .code(400)
                    .send({
                        error: {
                            code: "INVALID_REACTION",
                            message: "Supported reactions are like, favorite, and save.",
                        },
                    });
            const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { id: true },
            });
            if (!post)
                return reply
                    .code(404)
                    .send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } });
            await prisma.postReaction.deleteMany({ where: { userId: user.id, postId, type } });
            const state = await reactionState(postId, user.id);
            broadcastPostReaction({ postId, type, active: false, counts: state.counts });
            return ok(state);
        },
    );
};
