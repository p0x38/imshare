import type { FastifyRequest } from "fastify";

export function postIdsForSearchSync(request: FastifyRequest, payload: unknown): string[] {
    const pathname = request.url.split("?", 1)[0] ?? "/";
    if (!/^\/api\/v1\/(?:posts|texts|admin\/posts)(?:\/|$)/.test(pathname)) return [];
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return [];

    const ids = new Set<string>();
    const add = (value: unknown) => {
        if (typeof value === "string" && value) ids.add(value);
    };
    const params = request.params as Record<string, unknown> | undefined;
    add(params?.postId);
    add(params?.textId);

    const body = request.body as Record<string, unknown> | undefined;
    if (Array.isArray(body?.postIds)) body.postIds.forEach(add);

    if (typeof payload === "string") {
        try {
            const envelope = JSON.parse(payload) as { data?: unknown };
            if (Array.isArray(envelope.data)) {
                for (const post of envelope.data) {
                    if (post && typeof post === "object") add((post as Record<string, unknown>).id);
                }
            } else if (envelope.data && typeof envelope.data === "object") {
                const data = envelope.data as Record<string, unknown>;
                add(data.id);
                if (Array.isArray(data.postIds)) data.postIds.forEach(add);
            }
        } catch {
            return [...ids];
        }
    }
    return [...ids];
}
