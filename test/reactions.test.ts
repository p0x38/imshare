import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

const root = process.cwd();
const databasePath = path.join(root, "test-reactions.db");
const databaseFiles = [
    databasePath,
    `${databasePath}-journal`,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
];

process.env.DATABASE_URL = "file:./test-reactions.db";
process.env.BETTER_AUTH_SECRET = "4c7e5a9d2f8b6e1a3d0c9f5b7a2e8c6d1f4a9b3e7c0d5f8a2b6e9c1d4f7a3b8";

for (const file of databaseFiles) {
    if (existsSync(file)) rmSync(file, { force: true });
}

const { execFileSync } = await import("node:child_process");
const command = "pnpm exec prisma db push --accept-data-loss";
if (process.platform === "win32") {
    execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
    });
} else {
    execFileSync("pnpm", ["exec", "prisma", "db", "push", "--accept-data-loss"], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
    });
}

const { prisma } = await import("../src/lib/auth.js");
const { buildApp } = await import("../src/app.js");

after(async () => {
    await prisma.$disconnect();
    for (const file of databaseFiles) {
        if (existsSync(file)) rmSync(file, { force: true });
    }
});

test("reaction reads reject missing posts", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({ method: "GET", url: "/v1/posts/missing/reactions" });
        assert.equal(response.statusCode, 404);
        assert.equal(response.json().error.code, "POST_NOT_FOUND");
    } finally {
        await app.close();
    }
});

test("reaction writes require authentication", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({
            method: "PUT",
            url: "/v1/posts/missing/like",
        });
        assert.equal(response.statusCode, 401);
    } finally {
        await app.close();
    }
});

test("invalid reaction types are rejected before mutation", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({
            method: "PUT",
            url: "/v1/posts/missing/not-a-reaction",
        });
        assert.equal(response.statusCode, 401);
    } finally {
        await app.close();
    }
});
