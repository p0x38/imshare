import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "./env.js";
import { loadConfigSync, resolveBaseUrl } from "./config.js";

const adapter = new PrismaBetterSqlite3({
    url: env.databaseUrl,
});

export const prisma = new PrismaClient({ adapter });
const config = loadConfigSync();

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "sqlite",
    }),

    secret: env.betterAuthSecret,
    baseURL: resolveBaseUrl(config),
    basePath: "/v1/auth",

    user: {
        additionalFields: {
            bio: { type: "string", required: false },
            websiteUrl: { type: "string", required: false },
            githubUrl: { type: "string", required: false },
        },
    },

    emailAndPassword: {
        enabled: true,
    },

    session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
    },
});
