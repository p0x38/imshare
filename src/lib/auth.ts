import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "./env.js";
import { loadConfigSync } from "./config.js";

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
  baseURL: config.auth.baseUrl,
  basePath: "/v1/auth",

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});
