import type { FastifyReply, FastifyRequest } from "fastify";
import { auth, prisma } from "./auth.js";
import { hasRole, type UserRole } from "./permissions.js";

export type SessionUser = typeof auth.$Infer.Session.user;

export async function getSession(request: FastifyRequest) {
    const session = await auth.api.getSession({
        headers: request.headers as HeadersInit,
    });

    if (!session) return null;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isBanned: true, bannedUntil: true },
    });

    if (!user) return null;
    if (user.isBanned && (!user.bannedUntil || user.bannedUntil > new Date())) return null;

    return session;
}

export async function requireUser(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<SessionUser | undefined> {
    const session = await getSession(request);

    if (!session) {
        await reply.code(401).send({
            error: {
                code: "UNAUTHORIZED",
                message: "Authentication is required.",
            },
        });
        return undefined;
    }

    return session.user;
}

export async function requireRole(
    request: FastifyRequest,
    reply: FastifyReply,
    requiredRole: UserRole,
): Promise<SessionUser | undefined> {
    const user = await requireUser(request, reply);
    if (!user) return undefined;

    const roleRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
    });
    if (!roleRecord || !hasRole(roleRecord.role, requiredRole)) {
        await reply.code(403).send({
            error: {
                code: "FORBIDDEN",
                message: "You do not have permission to perform this action.",
            },
        });
        return undefined;
    }

    return user;
}

export function ok<T>(data: T) {
    return { data };
}

export function collection<T>(data: T[], page: number, limit: number, total: number) {
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export function parsePagination(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 24) || 24));
    return { page, limit, skip: (page - 1) * limit };
}

export function parseOrder(value: unknown): "asc" | "desc" {
    return value === "asc" ? "asc" : "desc";
}
