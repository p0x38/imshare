import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "./env.js";
import { loadConfigSync, resolveBaseUrl } from "./config.js";
import { createOpenIdPlugin } from "./openid.js";

const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
export const prisma = new PrismaClient({ adapter });
const config = loadConfigSync();
const baseUrl = resolveBaseUrl(config);
const trustedOrigins = [
    ...new Set([
        baseUrl,
        ...(config.auth.trustedOrigins ?? []),
        ...(process.env.NODE_ENV === "production"
            ? []
            : [`http://localhost:${config.server.port}`, `http://127.0.0.1:${config.server.port}`]),
    ]),
];
const openIdPlugin = createOpenIdPlugin();

export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "sqlite" }),
    secret: env.betterAuthSecret,
    baseURL: baseUrl,
    basePath: "/api/v1/auth",
    trustedOrigins,
    plugins: openIdPlugin ? [openIdPlugin] : [],
    user: {
        additionalFields: {
            bio: { type: "string", required: false },
            websiteUrl: { type: "string", required: false },
            githubUrl: { type: "string", required: false },
        },
    },
    emailAndPassword: { enabled: config.auth.emailAndPasswordEnabled !== false },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
});
