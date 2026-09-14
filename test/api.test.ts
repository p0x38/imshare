import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, expect, test } from "vitest";

const root = process.cwd();
const databasePath = path.join(root, "test-api.db");
const databaseFiles = [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`];

process.env.DATABASE_URL = "file:./test-api.db";
process.env.BETTER_AUTH_SECRET = "4c7e5a9d2f8b6e1a3d0c9f5b7a2e8c6d1f4a9b3e7c0d5f8a2b6e9c1d4f7a3b8";
process.env.IMSHARE_CONFIG = path.join(root, "test", "config.imshare");

for (const file of databaseFiles) if (existsSync(file)) rmSync(file, { force: true });

const prismaCommand = "pnpm exec prisma db push --accept-data-loss";
if (process.platform === "win32") {
    execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", prismaCommand], { cwd: root, env: process.env, stdio: "inherit" });
} else {
    execFileSync("pnpm", ["exec", "prisma", "db", "push", "--accept-data-loss"], { cwd: root, env: process.env, stdio: "inherit" });
}

const { collection, ok, parseOrder, parsePagination } = await import("../src/lib/api.js");
const { prisma } = await import("../src/lib/auth.js");
const { buildApp } = await import("../src/app.js");

afterAll(async () => {
    await prisma.$disconnect();
    for (const file of databaseFiles) if (existsSync(file)) rmSync(file, { force: true });
});

test("ok wraps data", () => expect(ok({ id: "post-1" })).toEqual({ data: { id: "post-1" } }));

test("collection returns pagination metadata", () => {
    expect(collection([1, 2], 2, 2, 5)).toEqual({ data: [1, 2], pagination: { page: 2, limit: 2, total: 5, totalPages: 3 } });
});

test("parsePagination clamps invalid values", () => {
    expect(parsePagination({ page: "0", limit: "999" })).toEqual({ page: 1, limit: 100, skip: 0 });
});

test("parseOrder defaults to descending", () => {
    expect(parseOrder(undefined)).toBe("desc");
    expect(parseOrder("asc")).toBe("asc");
    expect(parseOrder("invalid")).toBe("desc");
});

test("health, readiness, and version routes are publicly available", async () => {
    const app = await buildApp();
    try {
        const health = await app.inject({ method: "GET", url: "/v1/health" });
        expect(health.statusCode).toBe(200);
        expect(health.json()).toMatchObject({ status: "ok" });
        const ready = await app.inject({ method: "GET", url: "/v1/ready" });
        expect(ready.statusCode).toBe(200);
        expect(ready.json()).toMatchObject({ status: "ready" });
        const version = await app.inject({ method: "GET", url: "/v1/version" });
        expect(version.statusCode).toBe(200);
        expect(version.json()).toMatchObject({ data: { api: "v1", version: "1.0.0" } });
    } finally { await app.close(); }
});

test("security headers are present on API and HTML responses", async () => {
    const app = await buildApp();
    try {
        for (const url of ["/v1/health", "/"]) {
            const response = await app.inject({ method: "GET", url, headers: url === "/" ? { accept: "text/html" } : undefined });
            expect(response.headers["x-content-type-options"]).toBe("nosniff");
            expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
            expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
            expect(response.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
        }
    } finally { await app.close(); }
});

test("protected notification routes require authentication while comment listing is public", async () => {
    const app = await buildApp();
    try {
        for (const url of ["/v1/me/notifications", "/v1/me/notifications/unread-count"]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(401);
        }
        const comments = await app.inject({ method: "GET", url: "/v1/posts/missing/comments" });
        expect(comments.statusCode).toBe(200);
        expect(comments.json()).toMatchObject({ data: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } });
    } finally { await app.close(); }
});

test("reaction reads reject missing posts and writes require authentication", async () => {
    const app = await buildApp();
    try {
        const read = await app.inject({ method: "GET", url: "/v1/posts/missing/reactions" });
        expect(read.statusCode).toBe(404);
        expect(read.json().error.code).toBe("POST_NOT_FOUND");
        const write = await app.inject({ method: "PUT", url: "/v1/posts/missing/like" });
        expect(write.statusCode).toBe(401);
    } finally { await app.close(); }
});

test("state-changing requests reject foreign origins", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({ method: "POST", url: "/v1/me/notifications/read-all", headers: { origin: "https://attacker.example" } });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("CSRF_ORIGIN_REJECTED");
    } finally { await app.close(); }
});

test("image route rejects invalid transformation parameters", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({ method: "GET", url: "/v1/posts/image/missing?width=1" });
        expect(response.statusCode).toBe(404);
        const placeholder = await app.inject({ method: "GET", url: "/v1/posts/image/missing/placeholder" });
        expect(placeholder.statusCode).toBe(404);
    } finally { await app.close(); }
});

test("request schemas reject malformed post and user bodies", async () => {
    const app = await buildApp();
    try {
        const post = await app.inject({ method: "POST", url: "/v1/posts", payload: { title: "", unexpected: true } });
        expect(post.statusCode).toBe(400);
        const user = await app.inject({ method: "POST", url: "/v1/users", payload: { name: "test" } });
        expect(user.statusCode).toBe(400);
    } finally { await app.close(); }
});

test("custom emoji listing is public and creation is protected", async () => {
    const app = await buildApp();
    try {
        const list = await app.inject({ method: "GET", url: "/v1/emojis" });
        expect(list.statusCode).toBe(200);
        expect(list.json()).toMatchObject({ data: [] });
        const create = await app.inject({ method: "POST", url: "/v1/emojis", payload: { name: "blobcat", url: "/v1/posts/image/example" } });
        expect(create.statusCode).toBe(401);
    } finally { await app.close(); }
});

test("public API rejects unsupported methods cleanly", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({ method: "PATCH", url: "/v1/health" });
        expect(response.statusCode).toBe(404);
    } finally { await app.close(); }
});

test("missing API resources return structured errors", async () => {
    const app = await buildApp();
    try {
        for (const url of ["/v1/posts/missing", "/v1/tags/missing", "/v1/categories/missing"]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(404);
            expect(response.json().error).toEqual(expect.objectContaining({ code: expect.any(String), message: expect.any(String) }));
        }
    } finally { await app.close(); }
});

test("dedicated HTML error pages are served", async () => {
    const app = await buildApp();
    try {
        for (const [url, status] of [["/does-not-exist", 404], ["/v1/posts/image/missing?width=1", 404]] as const) {
            const response = await app.inject({ method: "GET", url, headers: { accept: "text/html" } });
            expect(response.statusCode).toBe(status);
            expect(response.headers["content-type"] ?? "").toMatch(/text\/html/);
        }
    } finally { await app.close(); }
});
