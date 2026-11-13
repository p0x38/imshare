import "dotenv/config";
import path from "node:path";
import { resolveDataDirectory } from "./storage-directories.js";

export type DatabaseProvider = "sqlite" | "postgresql";

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} must be configured in .env.`);
    }
    return value;
}

function optional(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value || undefined;
}

function optionalPort(name: string): number | undefined {
    const value = optional(name);
    if (!value) return undefined;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${name} must be a valid TCP port.`);
    }
    return port;
}

const databaseProvider = optional("DATABASE_PROVIDER") ?? "sqlite";
if (databaseProvider !== "sqlite" && databaseProvider !== "postgresql")
    throw new Error("DATABASE_PROVIDER must be either sqlite or postgresql.");
const selectedDatabaseProvider = databaseProvider as DatabaseProvider;

const databaseUrl = optional("DATABASE_URL");

if (selectedDatabaseProvider === "postgresql" && !databaseUrl) {
    throw new Error("DATABASE_URL must be configured for PostgreSQL.");
}

export const env = {
    databaseProvider: selectedDatabaseProvider,
    databaseUrl: databaseUrl ?? `file:${path.join(resolveDataDirectory(), "imshare.db")}`,
    betterAuthSecret: required("BETTER_AUTH_SECRET"),
    smtp: {
        host: optional("SMTP_HOST"),
        port: optionalPort("SMTP_PORT"),
        secure: optional("SMTP_SECURE") === "true",
        user: optional("SMTP_USER"),
        password: optional("SMTP_PASSWORD"),
        from: optional("SMTP_FROM"),
    },
    push: {
        publicKey: optional("VAPID_PUBLIC_KEY"),
        privateKey: optional("VAPID_PRIVATE_KEY"),
        subject: optional("VAPID_SUBJECT"),
    },
    meilisearch: {
        url: optional("MEILISEARCH_URL"),
        apiKey: optional("MEILISEARCH_API_KEY"),
        indexUid: optional("MEILISEARCH_INDEX_UID") ?? "imshare_posts",
    },
};
