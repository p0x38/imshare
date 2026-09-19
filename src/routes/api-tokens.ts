import type { FastifyPluginAsync } from "fastify";
import { generateApiToken, parsePermissions, serializePermissions, validateTokenName } from "../lib/api-tokens.js";
import { prisma } from "../lib/auth.js";
import { requireSessionUser, collection, ok } from "../lib/api.js";
import { openapi, request, parameter, type OpenApiSchema } from "../lib/openapi-route.js";

function parseExpiry(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== "string") return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) || date <= new Date() ? undefined : date;
}

function publicToken(token: {
    id: string; name: string; tokenPrefix: string; permissionsJson: string; enabled: boolean;
    expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date; updatedAt: Date;
}) {
    return {
        id: token.id, name: token.name, tokenPrefix: token.tokenPrefix,
        permissions: (() => { try { return parsePermissions(JSON.parse(token.permissionsJson)) ?? {}; } catch { return {}; } })(),
        enabled: token.enabled, expiresAt: token.expiresAt, lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt, updatedAt: token.updatedAt,
    };
}

const tokenId = parameter.path("tokenId", { type: "string" });
const permissionsSchema: OpenApiSchema = {
    type: "object",
    additionalProperties: {
        type: "array",
        items: { type: "string", enum: ["read", "write", "delete"] },
    },
};

export const apiTokenRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/me/api-tokens", { schema: openapi({
        tags: "Account", summary: "List API tokens",
        description: "Lists API credentials belonging to the authenticated account. Secrets are never returned.",
        operationId: "listMyApiTokens", security: [{ cookieAuth: [] }],
        responses: { "200": { description: "API token collection." }, "401": { $ref: "#/components/responses/Unauthorized" } },
    }) }, async (request, reply) => {
        const user = await requireSessionUser(request, reply); if (!user) return;
        const tokens = await prisma.apiToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
        return collection(tokens.map(publicToken), 1, tokens.length || 1, tokens.length);
    });

    fastify.post("/v1/me/api-tokens", { schema: openapi({
        tags: "Account", summary: "Create API token",
        description: "Creates an API credential. The secret is returned only once.",
        operationId: "createMyApiToken", security: [{ cookieAuth: [] }],
        requestBody: request.json({
            type: "object", required: ["name", "permissions"],
            properties: { name: { type: "string", minLength: 1, maxLength: 100 }, permissions: permissionsSchema, expiresAt: { type: "string", format: "date-time", nullable: true } },
        }),
        responses: { "201": { description: "Created API token." }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" } },
        responseExamples: { "201": { data: { token: "ims_...", tokenPrefix: "ims_xxxxxxxx" } } },
    }) }, async (request, reply) => {
        const user = await requireSessionUser(request, reply); if (!user) return;
        const body = request.body as Record<string, unknown>;
        const name = validateTokenName(body.name), permissions = parsePermissions(body.permissions), expiresAt = parseExpiry(body.expiresAt);
        if (!name || !permissions || expiresAt === undefined) return reply.code(400).send({ error: { code: "INVALID_API_TOKEN", message: "Invalid token name, permissions, or expiration." } });
        const generated = generateApiToken();
        const token = await prisma.apiToken.create({ data: {
            name, tokenPrefix: generated.prefix, tokenHash: generated.hash, permissionsJson: serializePermissions(permissions),
            expiresAt, userId: user.id,
        } });
        return reply.code(201).send(ok({ ...publicToken(token), token: generated.token }));
    });

    fastify.get("/v1/me/api-tokens/:tokenId", { schema: openapi({
        tags: "Account", summary: "Get API token", description: "Gets API token metadata. The secret is never returned.",
        operationId: "getMyApiToken", security: [{ cookieAuth: [] }], parameters: [tokenId],
        responses: { "200": { description: "API token metadata." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } },
    }) }, async (request, reply) => {
        const user = await requireSessionUser(request, reply); if (!user) return;
        const { tokenId: id } = request.params as { tokenId: string };
        const token = await prisma.apiToken.findFirst({ where: { id, userId: user.id } });
        if (!token) return reply.code(404).send({ error: { code: "API_TOKEN_NOT_FOUND", message: "API token not found." } });
        return ok(publicToken(token));
    });

    fastify.patch("/v1/me/api-tokens/:tokenId", { schema: openapi({
        tags: "Account", summary: "Update API token", description: "Updates API token metadata, permissions, expiration, or enabled state.",
        operationId: "updateMyApiToken", security: [{ cookieAuth: [] }], parameters: [tokenId],
        requestBody: request.json({
            type: "object", properties: {
                name: { type: "string", minLength: 1, maxLength: 100 }, permissions: permissionsSchema,
                expiresAt: { type: "string", format: "date-time", nullable: true }, enabled: { type: "boolean" },
            },
        }),
        responses: { "200": { description: "Updated API token." }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } },
    }) }, async (request, reply) => {
        const user = await requireSessionUser(request, reply); if (!user) return;
        const { tokenId: id } = request.params as { tokenId: string };
        const existing = await prisma.apiToken.findFirst({ where: { id, userId: user.id } });
        if (!existing) return reply.code(404).send({ error: { code: "API_TOKEN_NOT_FOUND", message: "API token not found." } });
        const body = request.body as Record<string, unknown>, data: Record<string, unknown> = {};
        if (body.name !== undefined) { const name = validateTokenName(body.name); if (!name) return reply.code(400).send({ error: { code: "INVALID_API_TOKEN_NAME", message: "Token name is invalid." } }); data.name = name; }
        if (body.permissions !== undefined) { const permissions = parsePermissions(body.permissions); if (!permissions) return reply.code(400).send({ error: { code: "INVALID_API_TOKEN_PERMISSIONS", message: "Token permissions are invalid." } }); data.permissionsJson = serializePermissions(permissions); }
        if (body.expiresAt !== undefined) { const expiresAt = parseExpiry(body.expiresAt); if (expiresAt === undefined) return reply.code(400).send({ error: { code: "INVALID_API_TOKEN_EXPIRY", message: "Expiration must be a future ISO 8601 date-time or null." } }); data.expiresAt = expiresAt; }
        if (body.enabled !== undefined) { if (typeof body.enabled !== "boolean") return reply.code(400).send({ error: { code: "INVALID_API_TOKEN", message: "enabled must be a boolean." } }); data.enabled = body.enabled; }
        return ok(publicToken(await prisma.apiToken.update({ where: { id }, data })));
    });

    fastify.delete("/v1/me/api-tokens/:tokenId", { schema: openapi({
        tags: "Account", summary: "Revoke API token", description: "Permanently revokes an API credential.",
        operationId: "deleteMyApiToken", security: [{ cookieAuth: [] }], parameters: [tokenId],
        responses: { "204": { description: "API token revoked." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } },
    }) }, async (request, reply) => {
        const user = await requireSessionUser(request, reply); if (!user) return;
        const { tokenId: id } = request.params as { tokenId: string };
        const existing = await prisma.apiToken.findFirst({ where: { id, userId: user.id } });
        if (!existing) return reply.code(404).send({ error: { code: "API_TOKEN_NOT_FOUND", message: "API token not found." } });
        await prisma.apiToken.delete({ where: { id } });
        return reply.code(204).send();
    });
};
