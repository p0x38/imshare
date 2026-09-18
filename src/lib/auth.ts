import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

import { env } from "./env.js";
import { loadConfigSync, resolveBaseUrl } from "./config.js";
import { createOpenIdPlugin } from "./openid.js";
import { createMailService } from "./mail.js";

const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
export const prisma = new PrismaClient({ adapter });
const config = loadConfigSync();
const baseUrl = resolveBaseUrl(config);
const trustedOrigins = [
    ...new Set([
        baseUrl,
        ...(config.auth.trustedOrigins ?? []),
        `http://localhost:${config.server.port}`,
        `http://127.0.0.1:${config.server.port}`,
        ...(process.env.NODE_ENV === "production" ? [] : [`http://[::1]:${config.server.port}`]),
    ]),
];
const openIdPlugin = createOpenIdPlugin();
const mail = createMailService(
    env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.password && env.smtp.from
        ? {
              host: env.smtp.host,
              port: env.smtp.port,
              secure: env.smtp.secure,
              user: env.smtp.user,
              password: env.smtp.password,
              from: env.smtp.from,
          }
        : null,
);
function sendAuthEmail(task: Promise<void>, type: string): void {
    void task.catch((error) => console.error(`[mail] ${type} email failed:`, error));
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "sqlite" }),
    secret: env.betterAuthSecret,
    baseURL: {
        allowedHosts: [new URL(baseUrl).host, "localhost:*", "127.0.0.1:*"],
        fallback: baseUrl,
    },
    basePath: "/api/v1/auth",
    trustedOrigins,
    appName: config.site.name,
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== "/sign-in/email" || !ctx.body?.email) return;
            const user = await prisma.user.findUnique({
                where: { email: String(ctx.body.email).trim().toLowerCase() },
                select: { registrationStatus: true },
            });
            if (user?.registrationStatus === "pending")
                return new Response(
                    JSON.stringify({
                        error: {
                            code: "REGISTRATION_PENDING",
                            message:
                                "Your registration request is waiting for administrator approval.",
                        },
                    }),
                    { status: 403, headers: { "content-type": "application/json" } },
                );
            if (user?.registrationStatus === "rejected")
                return new Response(
                    JSON.stringify({
                        error: {
                            code: "REGISTRATION_REJECTED",
                            message: "Your registration request was rejected.",
                        },
                    }),
                    { status: 403, headers: { "content-type": "application/json" } },
                );
        }),
    },
    plugins: [...(openIdPlugin ? [openIdPlugin] : []), twoFactor()],
    user: {
        additionalFields: {
            bio: { type: "string", required: false },
            websiteUrl: { type: "string", required: false },
            githubUrl: { type: "string", required: false },
        },
    },
    emailAndPassword: {
        enabled: config.auth.emailAndPasswordEnabled !== false,
        sendResetPassword: async ({ user, url }) => {
            if (!mail) {
                console.error("[mail] Password reset requested but SMTP is not configured.");
                return;
            }
            sendAuthEmail(
                mail.send({
                    to: user.email,
                    subject: "Reset your imshare password",
                    text: [
                        `Hello ${user.name || "there"},`,
                        "",
                        "A password reset was requested for your imshare account.",
                        "",
                        `Reset your password: ${url}`,
                        "",
                        "If you did not request this, you can safely ignore this email.",
                    ].join("\n"),
                }),
                "password reset",
            );
        },
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            if (!mail) {
                console.error("[mail] Email verification requested but SMTP is not configured.");
                return;
            }
            sendAuthEmail(
                mail.send({
                    to: user.email,
                    subject: "Verify your imshare email address",
                    text: [
                        `Hello ${user.name || "there"},`,
                        "",
                        "Please verify your email address for your imshare account.",
                        "",
                        `Verify your email: ${url}`,
                        "",
                        "If you did not create this account, you can safely ignore this email.",
                    ].join("\n"),
                }),
                "email verification",
            );
        },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
});
