import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";
import { openapi, parameter, request } from "../lib/openapi-route.js";
import type { OpenApiSchema } from "../lib/openapi-route.js";

const linkId = parameter.path("linkId", { type: "string" }, { description: "Profile link ID." });
const userId = parameter.path("userId", { type: "string" }, { description: "User ID." });
const linkBody = {
    type: "object",
    properties: {
        label: { type: "string", minLength: 1, maxLength: 100 },
        url: { type: "string", format: "uri" },
        position: { type: "integer", minimum: 0, maximum: 999 },
    },
} satisfies OpenApiSchema;

function normalizeUrl(value: string): string | undefined {
    try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) return undefined;
        return url.toString();
    } catch {
        return undefined;
    }
}

export const profileLinkRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/users/:userId/links", {
        schema: openapi({
            tags: "Profile Links",
            summary: "List a user's profile links",
            operationId: "listUserProfileLinks",
            parameters: [userId],
            security: [{}],
            responses: { "200": { description: "Profile links for the requested user." } },
        }),
    }, async (request) => {
        const { userId } = request.params as { userId: string };
        return ok(await prisma.profileLink.findMany({ where: { userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }));
    });

    fastify.post("/v1/me/links", {
        schema: openapi({
            tags: "Profile Links",
            summary: "Create a profile link",
            description: "Adds a profile link to the authenticated user's profile.",
            operationId: "createProfileLink",
            requestBody: request.json(linkBody, true),
            security: [{ cookieAuth: [] }],
            responses: {
                "201": { description: "Profile link created." },
                "400": { description: "Invalid link or profile link limit exceeded." },
                "401": { $ref: "#/components/responses/Unauthorized" },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const body = request.body as { label?: string; url?: string; position?: number };
        const label = body.label?.trim();
        const url = body.url ? normalizeUrl(body.url.trim()) : undefined;
        if (!label || label.length > 100 || !url) return reply.code(400).send({ error: { code: "INVALID_PROFILE_LINK", message: "A label and an HTTP(S) URL are required." } });
        const count = await prisma.profileLink.count({ where: { userId: user.id } });
        if (count >= 20) return reply.code(400).send({ error: { code: "TOO_MANY_PROFILE_LINKS", message: "A profile can have at most 20 links." } });
        return reply.code(201).send(ok(await prisma.profileLink.create({ data: { userId: user.id, label, url, position: Math.max(0, Math.min(999, Math.trunc(body.position ?? count))) } })));
    });

    fastify.patch("/v1/me/links/:linkId", {
        schema: openapi({
            tags: "Profile Links",
            summary: "Update a profile link",
            operationId: "updateProfileLink",
            parameters: [linkId],
            requestBody: request.json(linkBody, true),
            security: [{ cookieAuth: [] }],
            responses: {
                "200": { description: "Updated profile link." },
                "400": { description: "Invalid link data." },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": { $ref: "#/components/responses/NotFound" },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { linkId } = request.params as { linkId: string };
        const link = await prisma.profileLink.findUnique({ where: { id: linkId } });
        if (!link) return reply.code(404).send({ error: { code: "LINK_NOT_FOUND", message: "Profile link not found." } });
        if (link.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this profile link." } });
        const body = request.body as { label?: string; url?: string; position?: number };
        const label = body.label === undefined ? link.label : body.label.trim();
        const url = body.url === undefined ? link.url : normalizeUrl(body.url.trim());
        if (!label || label.length > 100 || !url) return reply.code(400).send({ error: { code: "INVALID_PROFILE_LINK", message: "A label and an HTTP(S) URL are required." } });
        return ok(await prisma.profileLink.update({ where: { id: linkId }, data: { label, url, ...(body.position !== undefined ? { position: Math.max(0, Math.min(999, Math.trunc(body.position))) } : {}) } }));
    });

    fastify.delete("/v1/me/links/:linkId", {
        schema: openapi({
            tags: "Profile Links",
            summary: "Delete a profile link",
            operationId: "deleteProfileLink",
            parameters: [linkId],
            security: [{ cookieAuth: [] }],
            responses: {
                "204": { description: "Profile link deleted." },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": { $ref: "#/components/responses/NotFound" },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { linkId } = request.params as { linkId: string };
        const link = await prisma.profileLink.findUnique({ where: { id: linkId } });
        if (!link) return reply.code(404).send({ error: { code: "LINK_NOT_FOUND", message: "Profile link not found." } });
        if (link.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this profile link." } });
        await prisma.profileLink.delete({ where: { id: linkId } });
        return reply.code(204).send();
    });
};