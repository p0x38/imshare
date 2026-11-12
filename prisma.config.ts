import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const databaseProvider = process.env.DATABASE_PROVIDER?.trim() || "sqlite";
if (databaseProvider !== "sqlite" && databaseProvider !== "postgresql")
    throw new Error("DATABASE_PROVIDER must be either sqlite or postgresql.");

export default defineConfig({
    schema:
        databaseProvider === "postgresql"
            ? "prisma/postgresql/schema.prisma"
            : "prisma/sqlite/schema.prisma",
    migrations: {
        path:
            databaseProvider === "postgresql"
                ? "prisma/postgresql/migrations"
                : "prisma/sqlite/migrations",
    },
    datasource: {
        url: env("DATABASE_URL"),
        ...(databaseProvider === "postgresql"
            ? {
                  shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
              }
            : {}),
    },
});
