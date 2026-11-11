import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

export function createPrismaClient(): PrismaClient {
    const adapter =
        env.databaseProvider === "postgresql"
            ? new PrismaPg(env.databaseUrl)
            : new PrismaBetterSqlite3({ url: env.databaseUrl });
    return new PrismaClient({ adapter });
}
