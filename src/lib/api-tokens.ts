import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./auth.js";

export const API_TOKEN_ACTIONS = ["read", "write", "delete"] as const;
export type ApiTokenAction = (typeof API_TOKEN_ACTIONS)[number];
export type ApiTokenPermissions = Record<string, ApiTokenAction[]>;

export interface ApiTokenAuth {
    id: string;
    userId: string;
    permissions: ApiTokenPermissions;
    expiresAt: Date | null;
    createdAt: Date;
}

const TOKEN_PREFIX = "ims_";
const TOKEN_RANDOM_BYTES = 32;
const MAX_NAME_LENGTH = 100;
const MAX_PERMISSION_KEYS = 32;

const tokenContexts = new WeakMap<FastifyRequest, ApiTokenAuth | null>();
const tokenPresence = new WeakMap<FastifyRequest, boolean>();

export function hashApiToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateApiToken(): { token: string; hash: string; prefix: string } {
    const token = TOKEN_PREFIX + randomBytes(TOKEN_RANDOM_BYTES).toString("base64url");
    return {
        token,
        hash: hashApiToken(token),
        prefix: token.slice(0, 12),
    };
}

export function parsePermissions(value: unknown): ApiTokenPermissions | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const entries = Object.entries(value);
    if (entries.length > MAX_PERMISSION_KEYS) return null;

    const result: ApiTokenPermissions = {};
    for (const [resource, actions] of entries) {
        if (!resource || resource.length > 64) return null;
        if (!Array.isArray(actions)) return null;

        const normalized = [...new Set(
            actions.filter(
                (action): action is ApiTokenAction =>
                    typeof action === "string" &&
                    (API_TOKEN_ACTIONS as readonly string[]).includes(action),
            ),
        )];

        if (!normalized.length) continue;
        result[resource] = normalized;
    }

    return result;
}

export function serializePermissions(permissions: ApiTokenPermissions): string {
    return JSON.stringify(permissions);
}

export function deserializePermissions(value: string): ApiTokenPermissions {
    try {
        return parsePermissions(JSON.parse(value)) ?? {};
    } catch {
        return {};
    }
}

export function permissionsAllow(
    permissions: ApiTokenPermissions,
    resource: string,
    action: ApiTokenAction,
): boolean {
    return Boolean(permissions["*"]?.includes(action) || permissions[resource]?.includes(action));
}

function actionForMethod(method: string): ApiTokenAction {
    switch (method.toUpperCase()) {
        case "GET":
        case "HEAD":
        case "OPTIONS":
            return "read";
        case "DELETE":
            return "delete";
        default:
            return "write";
    }
}

function resourceForPath(pathname: string): string | null {
    if (pathname.startsWith("/api/v1/auth/")) return null;

    const match = pathname.match(/^\/api\/v1\/([^/]+)/);
    if (!match) return null;

    switch (match[1]) {
        case "me":
            return "me";
        case "admin":
            return "admin";
        case "registration-token":
            return "account";
        case "posts":
            return "posts";
        case "users":
            return "users";
        case "comments":
            return "comments";
        case "tags":
            return "tags";
        case "categories":
            return "categories";
        case "uploads":
            return "uploads";
        case "emojis":
            return "emojis";
        case "reactions":
            return "reactions";
        case "notifications":
            return "notifications";
        case "follows":
            return "follows";
        case "search":
            return "search";
        case "recommendations":
            return "recommendations";
        case "avatars":
            return "avatars";
        case "permalinks":
            return "permalinks";
        case "texts":
            return "texts";
        case "health":
        case "ready":
        case "version":
            return null;
        default:
            return match[1];
    }
}

export function apiTokenPresented(request: FastifyRequest): boolean {
    const cached = tokenPresence.get(request);
    if (cached !== undefined) return cached;
    const value = request.headers.authorization;
    const presented = typeof value === "string" && /^Bearer\s+\S+$/i.test(value);
    tokenPresence.set(request, presented);
    return presented;
}

export async function getApiToken(request: FastifyRequest): Promise<ApiTokenAuth | null> {
    if (!apiTokenPresented(request)) return null;
    if (tokenContexts.has(request)) return tokenContexts.get(request) ?? null;

    const authorization = request.headers.authorization;
    const token =
        typeof authorization === "string" ? authorization.replace(/^Bearer\s+/i, "") : "";
    if (!token) {
        tokenContexts.set(request, null);
        return null;
    }

    const record = await prisma.apiToken.findUnique({
        where: { tokenHash: hashApiToken(token) },
        select: {
            id: true,
            userId: true,
            permissionsJson: true,
            enabled: true,
            expiresAt: true,
            createdAt: true,
        },
    });

    if (!record || !record.enabled || (record.expiresAt && record.expiresAt <= new Date())) {
        tokenContexts.set(request, null);
        return null;
    }

    const auth: ApiTokenAuth = {
        id: record.id,
        userId: record.userId,
        permissions: deserializePermissions(record.permissionsJson),
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
    };
    tokenContexts.set(request, auth);
    void prisma.apiToken
        .update({
            where: { id: record.id },
            data: { lastUsedAt: new Date() },
        })
        .catch(() => undefined);

    return auth;
}

export async function authorizeApiTokenRequest(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<boolean> {
    if (!apiTokenPresented(request)) return true;

    const token = await getApiToken(request);
    if (!token) {
        await reply.code(401).send({
            error: {
                code: "INVALID_API_TOKEN",
                message: "The API token is invalid, disabled, or expired.",
            },
        });
        return false;
    }

    const pathname = request.url.split("?", 1)[0] ?? "/";
    if (pathname.startsWith("/api/v1/auth/")) {
        await reply.code(401).send({
            error: {
                code: "API_TOKEN_AUTH_ENDPOINT",
                message: "API tokens cannot be used with the authentication endpoints.",
            },
        });
        return false;
    }

    const resource = resourceForPath(pathname);
    if (!resource) return true;

    const action = actionForMethod(request.method);
    if (!permissionsAllow(token.permissions, resource, action)) {
        await reply.code(403).send({
            error: {
                code: "API_TOKEN_PERMISSION_DENIED",
                message: `The API token does not have ${action} permission for ${resource}.`,
            },
        });
        return false;
    }

    return true;
}

export function validateTokenName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const name = value.trim();
    if (!name || name.length > MAX_NAME_LENGTH) return null;
    return name;
}
