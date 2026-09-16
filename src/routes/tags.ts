import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { openapi, parameter } from "../lib/openapi-route.js";
import { postInclude, postView } from "./_shared.js";
import { tagCreateSchema, tagUpdateSchema } from "./schemas.js";

const publicPostWhere = { status: "published", visibility: "public", hiddenAt: null, OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }], user: { isPublic: true, showPosts: true, showProfile: true, isBanned: false } };
const tagId = parameter.path("tagId", { type: "string" }, { description: "Tag ID." });
const pagination = [parameter.query("page", { type: "integer", minimum: 1, default: 1 }), parameter.query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }), parameter.query("order", { type: "string", enum: ["asc", "desc"] }), parameter.query("search", { type: "string" })];

export const tagRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/tags", { schema: openapi({ tags: "Tags", summary: "List tags", description: "Returns tags with post counts and optional name search.", operationId: "listTags", parameters: pagination, security: [{}], responses: { "200": { description: "Paginated tag collection." } } }) }, async (request) => {
        const q = request.query as Record<string, unknown>; const p = parsePagination(q); const where = typeof q.search === "string" ? { name: { contains: q.search } } : {};
        const [items, total] = await Promise.all([prisma.tag.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: parseOrder(q.order) }, include: { _count: { select: { posts: true } } } }), prisma.tag.count({ where })]);
        return collection(items, p.page, p.limit, total);
    });

    fastify.get("/v1/tags/autocomplete", { schema: openapi({ tags: "Tags", summary: "Autocomplete tags", description: "Returns tags matching a short search term.", operationId: "autocompleteTags", parameters: [parameter.query("q", { type: "string" }), parameter.query("limit", { type: "integer", minimum: 1, maximum: 20, default: 10 })], security: [{}], responses: { "200": { description: "Matching tags." } } }) }, async (request) => {
        const q = request.query as Record<string, unknown>; const term = typeof q.q === "string" ? q.q.trim() : ""; const parsedLimit = Number(q.limit); const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 20) : 10;
        const items = await prisma.tag.findMany({ where: term ? { OR: [{ name: { contains: term } }, { slug: { contains: term } }] } : {}, take: limit, orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } });
        return ok(items.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug, postCount: tag._count.posts })));
    });

    fastify.post("/v1/tags", { schema: { ...tagCreateSchema, ...openapi({ tags: "Tags", summary: "Create a tag", description: "Creates a tag for the authenticated user.", operationId: "createTag", security: [{ cookieAuth: [] }], responses: { "201": { description: "Tag created." }, "401": { $ref: "#/components/responses/Unauthorized" } } }) } }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return; const body = request.body as { name: string; slug: string };
        return reply.code(201).send(ok(await prisma.tag.create({ data: { name: body.name.trim(), slug: body.slug } })));
    });

    fastify.get("/v1/tags/:tagId", { schema: openapi({ tags: "Tags", summary: "Get a tag", description: "Returns a tag and its post count.", operationId: "getTag", parameters: [tagId], security: [{}], responses: { "200": { description: "Tag details." }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => {
        const { tagId } = request.params as { tagId: string }; const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { _count: { select: { posts: true } } } });
        if (!tag) return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } }); return ok(tag);
    });

    fastify.patch("/v1/tags/:tagId", { schema: { ...tagUpdateSchema, ...openapi({ tags: "Tags", summary: "Update a tag", description: "Updates a tag using the supplied fields.", operationId: "updateTag", parameters: [tagId], security: [{ cookieAuth: [] }], responses: { "200": { description: "Updated tag." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } }) } }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return; const { tagId } = request.params as { tagId: string }; const body = request.body as { name?: string; slug?: string };
        try { return ok(await prisma.tag.update({ where: { id: tagId }, data: { name: body.name?.trim(), slug: body.slug } })); } catch { return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } }); }
    });

    fastify.delete("/v1/tags/:tagId", { schema: openapi({ tags: "Tags", summary: "Delete a tag", description: "Deletes a tag.", operationId: "deleteTag", parameters: [tagId], security: [{ cookieAuth: [] }], responses: { "204": { description: "Tag deleted." }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } }) }, async (request, reply) => {
        const user = await requireUser(request, reply); if (!user) return; const { tagId } = request.params as { tagId: string };
        try { await prisma.tag.delete({ where: { id: tagId } }); } catch { return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } }); } return reply.code(204).send();
    });

    fastify.get("/v1/tags/:tagId/posts", { schema: openapi({ tags: "Tags", summary: "List posts for a tag", description: "Returns public posts associated with a tag.", operationId: "listTagPosts", parameters: [tagId, ...pagination.slice(0, 3)], security: [{}], responses: { "200": { description: "Paginated post collection." } } }) }, async (request) => {
        const { tagId } = request.params as { tagId: string }; const q = request.query as Record<string, unknown>; const p = parsePagination(q); const where = { ...publicPostWhere, tags: { some: { tagId } } };
        const [items, total] = await Promise.all([prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }), prisma.post.count({ where })]); return collection(items.map(postView), p.page, p.limit, total);
    });
};
