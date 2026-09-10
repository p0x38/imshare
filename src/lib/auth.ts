import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

const secret =
  process.env.BETTER_AUTH_SECRET ??
  "change-this-development-secret-to-a-random-32-byte-secret";

if (
  process.env.NODE_ENV === "production" &&
  secret === "change-this-development-secret-to-a-random-32-byte-secret"
) {
  throw new Error(
    "BETTER_AUTH_SECRET must be configured in production.",
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),

  secret,

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});