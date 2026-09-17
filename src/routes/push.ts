import type { FastifyPluginAsync } from "fastify";

import { ok, requireUser } from "../lib/api.js";
import { getPushPublicKey } from "../lib/push.js";
import { prisma } from "../lib/auth.js";
import { openapi, parameter, type OpenApiSchema } from "../lib/openapi-route.js";

const subscriptionSchema: OpenApiSchema = {
    type: "object",
    required: ["endpoint", "keys"],
    properties: {
        endpoint: { type: "string", minLength: 1, maxLength: 4096 },
        keys: {
            type: "object",
            required: ["p256dh", "auth"],
            properties: {
                p256dh: { type: "string", minLength: 1 },
                auth: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
        },
    },
    additionalProperties: false,
};

export const pushRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/v1/push/config",
        {
            schema: openapi({
                tags: "Notifications",
                summary: "Get Web Push configuration",
                description: "Returns the public VAPID key when Web Push is configured.",
                operationId: "getPushConfig",
                responses: { "200": { description: "Web Push public configuration." } },
            }),
        },
        async () => ok({ publicKey: getPushPublicKey() }),
    );

    fastify.post<{ Body: { endpoint: string; keys: { p256dh: string; auth: string } } }>(
        "/v1/me/push-subscriptions",
        {
            schema: openapi({
                tags: "Notifications",
                summary: "Register a Web Push subscription",
                description: "Stores the authenticated user's browser push subscription.",
                operationId: "registerPushSubscription",
                security: [{ cookieAuth: [] }],
                requestBody: { content: { "application/json": { schema: subscriptionSchema } } },
                responses: { "200": { description: "Registered subscription." } },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const subscription = await prisma.pushSubscription.upsert({
                where: { endpoint: request.body.endpoint },
                create: {
                    endpoint: request.body.endpoint,
                    p256dh: request.body.keys.p256dh,
                    auth: request.body.keys.auth,
                    userId: user.id,
                    userAgent: request.headers["user-agent"] ?? null,
                },
                update: {
                    p256dh: request.body.keys.p256dh,
                    auth: request.body.keys.auth,
                    userId: user.id,
                    userAgent: request.headers["user-agent"] ?? null,
                    updatedAt: new Date(),
                },
            });
            return ok({ id: subscription.id });
        },
    );

    fastify.delete<{ Querystring: { endpoint?: string } }>(
        "/v1/me/push-subscriptions",
        {
            schema: openapi({
                tags: "Notifications",
                summary: "Remove a Web Push subscription",
                description: "Removes a push subscription belonging to the authenticated user.",
                operationId: "removePushSubscription",
                parameters: [
                    parameter.query(
                        "endpoint",
                        { type: "string" },
                        { description: "Subscription endpoint." },
                    ),
                ],
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Removed subscription." } },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            if (request.query.endpoint)
                await prisma.pushSubscription.deleteMany({
                    where: { endpoint: request.query.endpoint, userId: user.id },
                });
            return ok({ removed: true });
        },
    );
};
