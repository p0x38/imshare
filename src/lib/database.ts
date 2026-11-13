import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

function ensureSqliteDirectory(): void {
    if (env.databaseProvider !== "sqlite" || !env.databaseUrl.startsWith("file:")) {
        return;
    }

    const databasePath = env.databaseUrl.slice("file:".length);
    const absolutePath = path.resolve(databasePath);

    mkdirSync(path.dirname(absolutePath), { recursive: true });
}

export function createPrismaClient(): PrismaClient {
    ensureSqliteDirectory();

    const adapter =
        env.databaseProvider === "postgresql"
            ? new PrismaPg(env.databaseUrl)
            : new PrismaBetterSqlite3({ url: env.databaseUrl });

    return new PrismaClient({ adapter });
}

export const prisma = createPrismaClient();
