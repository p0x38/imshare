import Database from "better-sqlite3";
import path from "node:path";
import { env } from "./env.js";

function databasePath(url: string): string {
    const value = url.replace(/^file:/, "").split("?", 1)[0];
    return path.resolve(process.cwd(), value);
}

const db = new Database(databasePath(env.databaseUrl));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS "feature_data" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    PRIMARY KEY ("scope", "key")
);
CREATE INDEX IF NOT EXISTS "feature_data_scope_updated_at_idx"
    ON "feature_data" ("scope", "updated_at");
`);

const getStatement = db.prepare("SELECT value FROM feature_data WHERE scope = ? AND key = ?");
const setStatement = db.prepare(`
    INSERT INTO feature_data (scope, key, value, created_at, updated_at)
    VALUES (@scope, @key, @value, @createdAt, @updatedAt)
    ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const deleteStatement = db.prepare("DELETE FROM feature_data WHERE scope = ? AND key = ?");
const listStatement = db.prepare("SELECT key, value FROM feature_data WHERE scope = ? ORDER BY updated_at DESC");

export function getFeature<T>(scope: string, key: string, fallback: T): T {
    const row = getStatement.get(scope, key) as { value?: string } | undefined;
    if (!row?.value) return fallback;
    try {
        return JSON.parse(row.value) as T;
    } catch {
        return fallback;
    }
}

export function setFeature<T>(scope: string, key: string, value: T): void {
    const now = new Date().toISOString();
    setStatement.run({
        scope,
        key,
        value: JSON.stringify(value),
        createdAt: now,
        updatedAt: now,
    });
}

export function deleteFeature(scope: string, key: string): void {
    deleteStatement.run(scope, key);
}

export function listFeatures<T>(scope: string): Array<{ key: string; value: T }> {
    return (listStatement.all(scope) as Array<{ key: string; value: string }>).flatMap((row) => {
        try {
            return [{ key: row.key, value: JSON.parse(row.value) as T }];
        } catch {
            return [];
        }
    });
}

export function closeFeatureStore(): void {
    db.close();
}
