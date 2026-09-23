import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser } from "../lib/api.js";
import { openapi, parameter } from "../lib/openapi-route.js";
import { postInclude, postView } from "./_shared.js";
import { userCreateSchema, userUpdateSchema } from "./schemas.js";
import { userBadges } from "../lib/user-badges.js";

const HANDLE_PATTERN = /^[a-z0-9_][a-z0-9_-]{2,31}$/;
const RESERVED_HANDLES = new Set([
    "admin",
    "api",
    "account",
    "dashboard",
    "login",
    "logout",
    "signup",
    "register",
    "users",
    "posts",
    "tags",
    "categories",
    "search",
    "about",
    "faq",
    "github",
    "privacy",
    "terms",
]);
function normalizeAvatarMode(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase();
    return ["default", "initials", "identicon", "gravatar", "custom"].includes(normalized ?? "")
        ? normalized
        : "initials";
}
function isExternalAvatarUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

const publicPostWhere = {
    status: "published",
    visibility: "public",
    hiddenAt: null,
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
};
const publicUserSelect = {
    id: true,
    name: true,
    handle: true,
    image: true,
    bio: true,
    websiteUrl: true,
    githubUrl: true,
    avatarMode: true,
    avatarValue: true,
    profileBannerUrl: true,
    accentColor: true,
    role: true,
    badgesJson: true,
    updatedAt: true,
    createdAt: true,
    _count: { select: { posts: { where: publicPostWhere } } },
};
function avatarUrl(userId: string, updatedAt: Date) {
    return `/v1/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(updatedAt.toISOString())}`;
}
function normalizeHandle(value: string | null | undefined) {
    if (value === null || value === undefined) return null;
    return value.trim().replace(/^@/, "").toLowerCase();
}
function validateHandle(handle: string | null) {
    if (handle === null) return undefined;
    if (!HANDLE_PATTERN.test(handle))
        return "Handle must be 3–32 characters and use only lowercase letters, numbers, underscores, and hyphens.";
    if (RESERVED_HANDLES.has(handle)) return "That handle is reserved.";
    return undefined;
}
async function publicUser(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            ...publicUserSelect,
            profileLinks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        },
    });
    if (!user) return undefined;
    return {
        ...user,
        avatarMode: normalizeAvatarMode(user.avatarMode),
        avatarUrl: avatarUrl(user.id, user.updatedAt),
        badges: userBadges(user),
    };
}
async function publicUserByHandle(handle: string) {
    const normalized = normalizeHandle(handle);
    if (!normalized) return undefined;
    const user = await prisma.user.findFirst({
        where: { OR: [{ handle: normalized }, { handle: `@${normalized}` }] },
        select: {
            ...publicUserSelect,
            profileLinks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        },
    });
    if (!user) return undefined;
    return {
        ...user,
        avatarMode: normalizeAvatarMode(user.avatarMode),
        avatarUrl: avatarUrl(user.id, user.updatedAt),
        badges: userBadges(user),
    };
}
async function resolveUserId(value: string) {
    if (!value.startsWith("@")) return value;
    const user = await publicUserByHandle(value);
    return user?.id;
}
async function currentUser(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            ...publicUserSelect,
            email: true,
            role: true,
            profileLinks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        },
    });
    if (!user) return undefined;
    return {
        ...user,
        avatarMode: normalizeAvatarMode(user.avatarMode),
        avatarUrl: avatarUrl(user.id, user.updatedAt),
        badges: userBadges(user),
    };
}
function handleConflict(reply: FastifyReply) {
    return reply
        .code(409)
        .send({ error: { code: "HANDLE_TAKEN", message: "That handle is already taken." } });
}

const userId = parameter.path(
    "userId",
    { type: "string" },
    { description: "User ID or @handle where supported." },
);
const pagination = [
    parameter.query("page", { type: "integer", minimum: 1, default: 1 }),
    parameter.query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }),
    parameter.query("order", { type: "string", enum: ["asc", "desc"] }),
];
const search = parameter.query(
    "search",
    { type: "string" },
    { description: "Search users by name, email, or handle." },
);

export const userRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get(
        "/v1/me",
        {
            schema: openapi({
                tags: "Users",
                summary: "Get current user",
                description: "Returns the authenticated user's profile and account information.",
                operationId: "getCurrentUser",
                security: [{ cookieAuth: [] }],
                responses: {
                    "200": { description: "Current user." },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            return ok(await currentUser(user.id));
        },
    );
    fastify.get(
        "/v1/me/posts",
        {
            schema: openapi({
                tags: "Users",
                summary: "List current user's posts",
                description: "Returns posts owned by the authenticated user.",
                operationId: "listMyPosts",
                parameters: pagination,
                security: [{ cookieAuth: [] }],
                responses: {
                    "200": { description: "Paginated post collection." },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                },
            }),
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const q = request.query as Record<string, unknown>;
            const p = parsePagination(q);
            const where = { userId: user.id };
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
    fastify.get(
        "/v1/users",
        {
            schema: openapi({
                tags: "Users",
                summary: "List users",
                description: "Returns a paginated public user directory with optional search.",
                operationId: "listUsers",
                parameters: [...pagination, search],
                security: [{}],
                responses: { "200": { description: "Paginated user collection." } },
            }),
        },
        async (request) => {
            const q = request.query as Record<string, unknown>;
            const p = parsePagination(q);
            const searchValue = typeof q.search === "string" ? q.search : undefined;
            const where = searchValue
                ? {
                      OR: [
                          { name: { contains: searchValue } },
                          { email: { contains: searchValue } },
                          {
                              handle: {
                                  contains:
                                      normalizeHandle(searchValue) ?? searchValue.toLowerCase(),
                              },
                          },
                      ],
                  }
                : {};
            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip: p.skip,
                    take: p.limit,
                    orderBy: { createdAt: parseOrder(q.order) },
                    select: publicUserSelect,
                }),
                prisma.user.count({ where }),
            ]);
            return collection(
                users.map((user) => ({
                    ...user,
                    avatarMode: normalizeAvatarMode(user.avatarMode),
                    avatarUrl: avatarUrl(user.id, user.updatedAt),
                    badges: userBadges(user),
                })),
                p.page,
                p.limit,
                total,
            );
        },
    );
    fastify.post(
        "/v1/users",
        {
            schema: {
                ...userCreateSchema,
                ...openapi({
                    tags: "Users",
                    summary: "Create a user",
                    description: "Creates a user record for the authenticated requester.",
                    operationId: "createUser",
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "201": { description: "User created." },
                        "400": { $ref: "#/components/responses/BadRequest" },
                        "401": { $ref: "#/components/responses/Unauthorized" },
                        "409": { description: "Handle is already taken." },
                    },
                }),
            },
        },
        async (request, reply) => {
            const user = await requireUser(request, reply);
            if (!user) return;
            const body = request.body as {
                name: string;
                handle?: string | null;
                email: string;
                image?: string;
                bio?: string;
                websiteUrl?: string;
                githubUrl?: string;
            };
            const handle = normalizeHandle(body.handle);
            const handleError = validateHandle(handle);
            if (handleError)
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_HANDLE", message: handleError } });
            try {
                return reply
                    .code(201)
                    .send(
                        ok(
                            await prisma.user.create({
                                data: {
                                    id: randomUUID(),
                                    name: body.name.trim(),
                                    handle,
                                    email: body.email.trim(),
                                    image: body.image,
                                    bio: body.bio?.trim() || undefined,
                                    websiteUrl: body.websiteUrl?.trim() || undefined,
                                    githubUrl: body.githubUrl?.trim() || undefined,
                                },
                            }),
                        ),
                    );
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
                    return handleConflict(reply);
                throw error;
            }
        },
    );
    fastify.get(
        "/v1/users/@:handle",
        {
            schema: openapi({
                tags: "Users",
                summary: "Get user by handle",
                description: "Returns a public user profile resolved by handle.",
                operationId: "getUserByHandle",
                parameters: [parameter.path("handle", { type: "string" })],
                security: [{}],
                responses: {
                    "200": { description: "Public user profile." },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request, reply) => {
            const { handle } = request.params as { handle: string };
            const user = await publicUserByHandle(handle);
            if (!user)
                return reply
                    .code(404)
                    .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
            return ok(user);
        },
    );
    fastify.get(
        "/v1/users/:userId",
        {
            schema: openapi({
                tags: "Users",
                summary: "Get user",
                description: "Returns a public user profile by ID or @handle.",
                operationId: "getUser",
                parameters: [userId],
                security: [{}],
                responses: {
                    "200": { description: "Public user profile." },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request, reply) => {
            const { userId } = request.params as { userId: string };
            const user = userId.startsWith("@")
                ? await publicUserByHandle(userId)
                : await publicUser(userId);
            if (!user)
                return reply
                    .code(404)
                    .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
            return ok(user);
        },
    );
    fastify.patch(
        "/v1/users/:userId",
        {
            schema: {
                ...userUpdateSchema,
                ...openapi({
                    tags: "Users",
                    summary: "Update user",
                    description: "Updates the authenticated user's profile fields.",
                    operationId: "updateUser",
                    parameters: [userId],
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "200": { description: "Updated user." },
                        "400": { $ref: "#/components/responses/BadRequest" },
                        "401": { $ref: "#/components/responses/Unauthorized" },
                        "403": { $ref: "#/components/responses/Forbidden" },
                        "409": { description: "Handle is already taken." },
                    },
                }),
            },
        },
        async (request, reply) => {
            const me = await requireUser(request, reply);
            if (!me) return;
            const { userId } = request.params as { userId: string };
            if (me.id !== userId)
                return reply
                    .code(403)
                    .send({
                        error: { code: "FORBIDDEN", message: "You cannot modify this user." },
                    });
            const body = request.body as {
                name?: string;
                handle?: string | null;
                image?: string | null;
                bio?: string | null;
                websiteUrl?: string | null;
                githubUrl?: string | null;
                avatarMode?: string;
                avatarValue?: string | null;
                profileBannerUrl?: string | null;
                accentColor?: string | null;
            };
            const handle = body.handle === undefined ? undefined : normalizeHandle(body.handle);
            const handleError = validateHandle(handle ?? null);
            if (handleError)
                return reply
                    .code(400)
                    .send({ error: { code: "INVALID_HANDLE", message: handleError } });
            if (
                body.avatarMode !== undefined &&
                !["default", "initials", "identicon", "gravatar", "custom"].includes(
                    body.avatarMode,
                )
            )
                return reply
                    .code(400)
                    .send({
                        error: { code: "INVALID_AVATAR_MODE", message: "Unsupported avatar mode." },
                    });
            let nextAvatarValue: string | null | undefined = body.avatarValue;

            if (body.avatarMode !== undefined || body.avatarValue !== undefined) {
                const currentAvatar = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { avatarMode: true, avatarValue: true },
                });
                if (!currentAvatar)
                    return reply.code(404).send({
                        error: { code: "USER_NOT_FOUND", message: "User not found." },
                    });

                const nextAvatarMode = body.avatarMode ?? currentAvatar.avatarMode;
                nextAvatarValue =
                    body.avatarValue !== undefined
                        ? body.avatarValue?.trim() || null
                        : currentAvatar.avatarValue;

                if (nextAvatarMode !== "custom") {
                    nextAvatarValue = null;
                } else if (!nextAvatarValue) {
                    return reply.code(400).send({
                        error: {
                            code: "CUSTOM_AVATAR_REQUIRED",
                            message: "Custom avatar mode requires an image upload or an http(s) avatar URL.",
                        },
                    });
                } else if (!isExternalAvatarUrl(nextAvatarValue)) {
                    const upload = await prisma.upload.findFirst({
                        where: { id: nextAvatarValue, userId, storageArea: "avatars" },
                        select: { id: true },
                    });
                    if (!upload)
                        return reply.code(400).send({
                            error: {
                                code: "INVALID_AVATAR_VALUE",
                                message: "Custom avatar upload was not found or is not owned by this user.",
                            },
                        });
                }
            }

            try {
                const updated = await prisma.user.update({
                    where: { id: userId },
                    data: {
                        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
                        ...(body.handle !== undefined ? { handle } : {}),
                        ...(body.image !== undefined ? { image: body.image } : {}),
                        ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
                        ...(body.websiteUrl !== undefined
                            ? { websiteUrl: body.websiteUrl?.trim() || null }
                            : {}),
                        ...(body.githubUrl !== undefined
                            ? { githubUrl: body.githubUrl?.trim() || null }
                            : {}),
                        ...(body.avatarMode !== undefined ? { avatarMode: body.avatarMode } : {}),
                        ...(body.avatarMode !== undefined || body.avatarValue !== undefined
                            ? { avatarValue: nextAvatarValue ?? null }
                            : {}),
                        ...(body.profileBannerUrl !== undefined
                            ? { profileBannerUrl: body.profileBannerUrl?.trim() || null }
                            : {}),
                        ...(body.accentColor !== undefined
                            ? { accentColor: body.accentColor || null }
                            : {}),
                    },
                });
                return ok({ ...updated, avatarUrl: avatarUrl(updated.id, updated.updatedAt) });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
                    return handleConflict(reply);
                throw error;
            }
        },
    );
    fastify.delete(
        "/v1/users/:userId",
        {
            schema: openapi({
                tags: "Users",
                summary: "Delete user",
                description: "Deletes the authenticated user's account.",
                operationId: "deleteUser",
                parameters: [userId],
                security: [{ cookieAuth: [] }],
                responses: {
                    "204": { description: "User deleted." },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                },
            }),
        },
        async (request, reply) => {
            const me = await requireUser(request, reply);
            if (!me) return;
            const { userId } = request.params as { userId: string };
            if (me.id !== userId)
                return reply
                    .code(403)
                    .send({
                        error: { code: "FORBIDDEN", message: "You cannot delete this user." },
                    });
            await prisma.user.delete({ where: { id: userId } });
            return reply.code(204).send();
        },
    );
    fastify.get(
        "/v1/users/:userId/posts",
        {
            schema: openapi({
                tags: "Users",
                summary: "List a user's posts",
                description: "Returns public posts authored by a user.",
                operationId: "listUserPosts",
                parameters: [userId, ...pagination],
                security: [{}],
                responses: {
                    "200": { description: "Paginated post collection." },
                    "404": { $ref: "#/components/responses/NotFound" },
                },
            }),
        },
        async (request, reply) => {
            const { userId: requestedUserId } = request.params as { userId: string };
            const resolved = await resolveUserId(requestedUserId);
            if (!resolved)
                return reply
                    .code(404)
                    .send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
            const q = request.query as Record<string, unknown>;
            const p = parsePagination(q);
            const where = { userId: resolved, ...publicPostWhere };
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
