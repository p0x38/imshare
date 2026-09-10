import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "./auth.js";

export type SessionUser = typeof auth.$Infer.Session.user;

export async function getSession(request: FastifyRequest) {
  return auth.api.getSession({
    headers: request.headers as HeadersInit,
  });
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

export function ok<T>(data: T) {
  return { data };
}

export function collection<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
) {
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
