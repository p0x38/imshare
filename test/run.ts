import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const databasePath = path.join(root, "test.db");
const databaseFiles = [
    databasePath,
    `${databasePath}-journal`,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
];

process.env.DATABASE_URL = "file:./test.db";
process.env.BETTER_AUTH_SECRET = "4c7e5a9d2f8b6e1a3d0c9f5b7a2e8c6d1f4a9b3e7c0d5f8a2b6e9c1d4f7a3b8";

function cleanup(): void {
    for (const file of databaseFiles) {
        if (existsSync(file)) rmSync(file, { force: true });
    }
}

cleanup();

const pnpmOptions = {
    cwd: root,
    env: process.env,
    stdio: "inherit" as const,
};

try {
    if (process.platform === "win32") {
        execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec prisma migrate deploy"], pnpmOptions);
        execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec vitest run --config vitest.integration.config.ts"], pnpmOptions);
    } else {
        execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], pnpmOptions);
        execFileSync("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"], pnpmOptions);
    }
} finally {
    cleanup();
}
