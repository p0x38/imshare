import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { openapi, parameter, request } from "../lib/openapi-route.js";
import { postInclude, postView } from "./_shared.js";
import { categoryCreateSchema, categoryUpdateSchema } from "./schemas.js";

const publicPostWhere = {
    status: "published",
    visibility: "public",
    hiddenAt: null,
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    user: { isPublic: true, showPosts: true, showProfile: true, isBanned: false },
};

const categoryId = parameter.path(
    "categoryId",
    { type: "string" },
    { description: "Category ID." },
);
const listParameters = [
    parameter.query(
        "page",
        { type: "integer", minimum: 1, default: 1 },
        { description: "1-based page number." },
    ),
    parameter.query(
        "limit",
        { type: "integer", minimum: 1, maximum: 100, default: 20 },
        { description: "Maximum number of categories to return." },
    ),
    parameter.query(
        "order",
        { type: "string", enum: ["asc", "desc"], default: "asc" },
        { description: "Sort direction." },
    ),
];
const postListParameters = [
    categoryId,
    parameter.query(
        "page",
        { type: "integer", minimum: 1, default: 1 },
        { description: "1-based page number." },
    ),
    parameter.query(
        "limit",
        { type: "integer", minimum: 1, maximum: 100, default: 20 },
        { description: "Maximum number of posts to return." },
    ),
    parameter.query(
        "order",
        { type: "string", enum: ["asc", "desc"], default: "desc" },
        { description: "Sort direction." },
    ),
];

export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/v1/categories",
        {
            schema: openapi({
                tags: "Categories",
                summary: "List categories",
                description: "Returns paginated public categories ordered by name.",
                operationId: "listCategories",
                parameters: listParameters,
                responses: {
                    "200": { description: "Paginated category collection." },
                },
            }),
        },
        async (request) => {
            const q = request.query as Record<string, unknown>;
            const p = parsePagination(q);
            const [items, total] = await Promise.all([
                prisma.category.findMany({
                    skip: p.skip,
                    take: p.limit,
                    orderBy: { name: parseOrder(q.order) },
                    include: { _count: { select: { posts: true } } },
                }),
                prisma.category.count(),
            ]);
            return collection(items, p.page, p.limit, total);
        },
    );

    fastify.post(
        "/v1/categories",
        {
            schema: openapi(
                {
                    tags: "Categories",
                    summary: "Create category",
                    description: "Creates a category. Authentication is required.",
                    operationId: "createCategory",
                    requestBody: request.json(
                        { $ref: "#/components/schemas/CategoryCreate" } as never,
                        { required: true },
                    ),
                    responses: {
                        "201": { description: "Category created successfully." },
                        "400": { $ref: "#/components/responses/BadRequest" },
                        "401": { $ref: "#/components/responses/Unauthorized" },
                        "409": { $ref: "#/components/responses/Conflict" },
                    },
                },
                categoryCreateSchema,
            ),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const body = request.body as { name: string; slug: string; description?: string };
            return reply.code(201).send(
                ok(
                    await prisma.category.create({
                        data: {
                            name: body.name.trim(),
                            slug: body.slug,
                            description: body.description,
                        },
                    }),
                ),
            );
        },
    );

    fastify.get(
        "/v1/categories/:categoryId",
        {
            schema: openapi({
                tags: "Categories",
                summary: "Get category",
                description: "Returns a public category and its post count.",
                operationId: "getCategory",
                parameters: [categoryId],
                responses: {
                    "200": { description: "Category resource." },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request, reply) => {
            const { categoryId } = request.params as { categoryId: string };
            const category = await prisma.category.findUnique({
                where: { id: categoryId },
                include: { _count: { select: { posts: true } } },
            });
            if (!category)
                return reply
                    .code(404)
                    .send({
                        error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." },
                    });
            return ok(category);
        },
    );

    fastify.patch(
        "/v1/categories/:categoryId",
        {
            schema: openapi(
                {
                    tags: "Categories",
                    summary: "Update category",
                    description: "Updates a category. Authentication is required.",
                    operationId: "updateCategory",
                    parameters: [categoryId],
                    requestBody: request.json(
                        { $ref: "#/components/schemas/CategoryUpdate" } as never,
                        { required: true },
                    ),
                    responses: {
                        "200": { description: "Category updated successfully." },
                        "400": { $ref: "#/components/responses/BadRequest" },
                        "401": { $ref: "#/components/responses/Unauthorized" },
                        "404": { $ref: "#/components/responses/NotFound" },
                        "409": { $ref: "#/components/responses/Conflict" },
                    },
                },
                categoryUpdateSchema,
            ),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { categoryId } = request.params as { categoryId: string };
            const body = request.body as {
                name?: string;
                slug?: string;
                description?: string | null;
            };
            try {
                return ok(
                    await prisma.category.update({
                        where: { id: categoryId },
                        data: {
                            name: body.name?.trim(),
                            slug: body.slug,
                            description: body.description,
                        },
                    }),
                );
            } catch {
                return reply.code(404).send({
                    error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." },
                });
            }
        },
    );

    fastify.delete(
        "/v1/categories/:categoryId",
        {
            schema: openapi({
                tags: "Categories",
                summary: "Delete category",
                description:
                    "Deletes a category. Authentication is required. Returns 204 on success.",
                operationId: "deleteCategory",
                parameters: [categoryId],
                responses: {
                    "204": { description: "Category deleted successfully." },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const { categoryId } = request.params as { categoryId: string };
            try {
                await prisma.category.delete({ where: { id: categoryId } });
            } catch {
                return reply
                    .code(404)
                    .send({
                        error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." },
                    });
            }
            return reply.code(204).send();
        },
    );

    fastify.get(
        "/v1/categories/:categoryId/posts",
        {
            schema: openapi({
                tags: "Categories",
                summary: "List posts for category",
                description: "Returns a paginated list of public posts associated with a category.",
                operationId: "listCategoryPosts",
                parameters: postListParameters,
                responses: {
                    "200": { description: "Paginated post collection." },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request) => {
            const { categoryId } = request.params as { categoryId: string };
            const q = request.query as Record<string, unknown>;
            const p = parsePagination(q);
            const where = { ...publicPostWhere, categoryId };
            const [items, total] = await Promise.all([
                prisma.post.findMany({
                    where,
                    include: postInclude,
                    skip: p.skip,
                    take: p.limit,
                    orderBy: { createdAt: parseOrder(q.order) },
                }),
                prisma.post.count({ where }),
            ]);
            return collection(items.map(postView), p.page, p.limit, total);
        },
    );
};
