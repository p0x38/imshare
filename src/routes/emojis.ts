import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/auth.js";
import { ok, requireUser } from "../lib/api.js";
import { openapi, parameter, request } from "../lib/openapi-route.js";
import type { OpenApiSchema } from "../lib/openapi-route.js";

const NAME_RE = /^[a-z0-9_+-]{1,32}$/;
const UPLOAD_URL_RE = /^\/v1\/posts\/image\/([^/]+)$/;
const emojiId = parameter.path("emojiId", { type: "string" }, { description: "Emoji ID." });
const emojiBody = {
    type: "object",
    required: ["name", "url"],
    properties: {
        name: { type: "string", pattern: "^[a-z0-9_+-]{1,32}$", minLength: 1, maxLength: 32 },
        url: { type: "string", format: "uri", description: "An imshare upload URL under /v1/posts/image/." },
    },
} satisfies OpenApiSchema;

export const emojiRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/emojis", {
        schema: openapi({
            tags: "Emojis",
            summary: "List custom emojis",
            description: "Returns all custom emojis ordered by name.",
            operationId: "listEmojis",
            security: [{}],
            responses: { "200": { description: "Available custom emojis." } },
        }),
    }, async () => ok(await prisma.emoji.findMany({ orderBy: [{ name: "asc" }] })));

    fastify.post("/v1/emojis", {
        schema: openapi({
            tags: "Emojis",
            summary: "Create a custom emoji",
            description: "Creates a custom emoji from an image upload owned by the authenticated user.",
            operationId: "createEmoji",
            requestBody: request.json(emojiBody, true),
            security: [{ cookieAuth: [] }],
            responses: {
                "201": { description: "Custom emoji created." },
                "400": { description: "Invalid emoji name or image URL." },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": { $ref: "#/components/responses/NotFound" },
                "409": { description: "Emoji name is already in use." },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const body = request.body as { name?: unknown; url?: unknown };
        const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
        const url = typeof body.url === "string" ? body.url.trim() : "";
        if (!NAME_RE.test(name)) return reply.code(400).send({ error: { code: "INVALID_EMOJI_NAME", message: "Emoji names may contain lowercase letters, numbers, underscores, plus, and hyphens." } });
        const match = UPLOAD_URL_RE.exec(url);
        const uploadId = match?.[1];
        if (!uploadId) return reply.code(400).send({ error: { code: "INVALID_EMOJI_URL", message: "Emoji images must use an imshare image URL." } });
        const upload = await prisma.upload.findUnique({ where: { id: decodeURIComponent(uploadId) } });
        if (!upload) return reply.code(404).send({ error: { code: "UPLOAD_NOT_FOUND", message: "The emoji image upload was not found." } });
        if (upload.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You can only use your own uploads for custom emojis." } });
        try {
            return reply.code(201).send(ok(await prisma.emoji.create({ data: { name, url, creatorId: user.id } })));
        } catch (error: any) {
            if (error?.code === "P2002") return reply.code(409).send({ error: { code: "EMOJI_EXISTS", message: "That emoji name is already in use." } });
            throw error;
        }
    });

    fastify.delete("/v1/emojis/:emojiId", {
        schema: openapi({
            tags: "Emojis",
            summary: "Delete a custom emoji",
            operationId: "deleteEmoji",
            parameters: [emojiId],
            security: [{ cookieAuth: [] }],
            responses: {
                "204": { description: "Custom emoji deleted." },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": { $ref: "#/components/responses/NotFound" },
            },
        }),
    }, async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) return;
        const { emojiId } = request.params as { emojiId: string };
        const emoji = await prisma.emoji.findUnique({ where: { id: emojiId } });
        if (!emoji) return reply.code(404).send({ error: { code: "EMOJI_NOT_FOUND", message: "Emoji not found." } });
        if (emoji.creatorId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this emoji." } });
        await prisma.emoji.delete({ where: { id: emojiId } });
        return reply.code(204).send();
    });
};