import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { auth } from "../lib/auth.js";
import { getPublicConfig, loadConfig } from "../lib/config.js";
import { getRegistrationToken, isValidRegistrationToken } from "../lib/registration-token.js";

function toWebRequest(request: FastifyRequest, body?: unknown): Request {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) for (const item of value) headers.append(key, item);
        else headers.set(key, value);
    }
    const protocol = headers.get("x-forwarded-proto") ?? "http";
    const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
    const url = `${protocol}://${host}${request.raw.url ?? "/"}`;
    const method = request.method.toUpperCase();
    let requestBody: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
        const value = body ?? request.body;
        if (value !== undefined) {
            requestBody = typeof value === "string" ? value : JSON.stringify(value);
            if (!headers.has("content-type")) headers.set("content-type", "application/json");
        }
    }
    return new Request(url, { method, headers, body: requestBody });
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get("/v1/config", async () => getPublicConfig(await loadConfig()));

    fastify.get("/v1/registration-token", async (request, reply) => {
        const config = await loadConfig();
        if (!config.auth.registration?.enabled || config.auth.registration.public) {
            return reply.code(404).send({ error: { code: "REGISTRATION_TOKEN_DISABLED", message: "A registration token is not required." } });
        }
        const session = await auth.api.getSession({ headers: request.headers as HeadersInit });
        if (!session) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
        const { token, expiresAt } = getRegistrationToken();
        return { data: { token, expiresAt } };
    });

    fastify.route({
        method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        url: "/v1/auth/*",
        handler: async (request, reply) => {
            const config = await loadConfig();
            const isRegistration = request.method === "POST" && request.url.split("?", 1)[0] === "/v1/auth/sign-up/email";
            let body = request.body;
            if (isRegistration) {
                if (!config.auth.emailAndPasswordEnabled) return reply.code(404).send({ error: { code: "AUTH_DISABLED", message: "Email and password authentication is disabled." } });
                if (!config.auth.registration?.enabled) return reply.code(403).send({ error: { code: "REGISTRATION_DISABLED", message: "Registration is disabled." } });
                const publicRegistration = config.auth.registration.public === true;
                const registrationToken = typeof body === "object" && body !== null && "registrationToken" in body ? (body as { registrationToken?: unknown }).registrationToken : undefined;
                if (!publicRegistration && !isValidRegistrationToken(registrationToken)) return reply.code(403).send({ error: { code: "INVALID_REGISTRATION_TOKEN", message: "A valid registration access token is required." } });
                if (typeof body === "object" && body !== null) {
                    const { registrationToken: _registrationToken, ...authBody } = body as Record<string, unknown>;
                    body = authBody;
                }
            } else if (!config.auth.emailAndPasswordEnabled && request.url.includes("/sign-in/email")) {
                return reply.code(404).send({ error: { code: "AUTH_DISABLED", message: "Email and password authentication is disabled." } });
            }
            const response = await auth.handler(toWebRequest(request, body));
            reply.code(response.status);
            response.headers.forEach((value, key) => reply.header(key, value));
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json") || contentType?.includes("text/")) return reply.send(await response.text());
            return reply.send(Buffer.from(await response.arrayBuffer()));
        },
    });
};
