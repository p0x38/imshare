import type { FastifyInstance } from "fastify";

import { requireRole, ok } from "../lib/api.js";
import { env } from "../lib/env.js";
import { sendTestEmail } from "../lib/mail.js";

function configured() {
    return Boolean(
        env.smtp.host &&
            env.smtp.port &&
            env.smtp.user &&
            env.smtp.password &&
            env.smtp.from,
    );
}

export async function registerAdminMailRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post("/v1/admin/mail/test", async (request, reply) => {
        const actor = await requireRole(request, reply, "admin");
        if (!actor) return;

        if (!configured()) {
            return reply.code(503).send({
                error: {
                    code: "SMTP_NOT_CONFIGURED",
                    message: "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.",
                },
            });
        }

        const body = request.body as { recipient?: unknown } | undefined;
        const recipient = typeof body?.recipient === "string" ? body.recipient.trim() : "";
        if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
            return reply.code(400).send({
                error: { code: "INVALID_RECIPIENT", message: "A valid recipient email address is required." },
            });
        }

        try {
            await sendTestEmail(
                {
                    host: env.smtp.host!,
                    port: env.smtp.port!,
                    secure: env.smtp.secure,
                    user: env.smtp.user!,
                    password: env.smtp.password!,
                    from: env.smtp.from!,
                },
                recipient,
            );
        } catch (error) {
            request.log.error({ err: error }, "SMTP test email failed");
            return reply.code(502).send({
                error: {
                    code: "SMTP_SEND_FAILED",
                    message: error instanceof Error ? error.message : "SMTP test email failed.",
                },
            });
        }

        return ok({ sent: true, recipient });
    });
}
