import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, expect, test } from "vitest";

const root = process.cwd();
const databasePath = path.join(root, "test-api.db");
const databaseFiles = [
    databasePath,
    `${databasePath}-journal`,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
];

process.env.DATABASE_URL = "file:./test-api.db";
process.env.BETTER_AUTH_SECRET = "4c7e5a9d2f8b6e1a3d0c9f5b7a2e8c6d1f4a9b3e7c0d5f8a2b6e9c1d4f7a3b8";
process.env.IMSHARE_CONFIG = path.join(root, "test", "config.imshare");

for (const file of databaseFiles) if (existsSync(file)) rmSync(file, { force: true });

const prismaCommand = "pnpm exec prisma db push --accept-data-loss";
if (process.platform === "win32") {
    execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", prismaCommand], {
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

const { collection, ok, parseOrder, parsePagination } = await import("../src/lib/api.js");
const { prisma } = await import("../src/lib/auth.js");
const { buildApp } = await import("../src/app.js");

afterAll(async () => {
    await prisma.$disconnect();
    for (const file of databaseFiles) if (existsSync(file)) rmSync(file, { force: true });
});

test("ok wraps data", () => expect(ok({ id: "post-1" })).toEqual({ data: { id: "post-1" } }));

test("collection returns pagination metadata", () => {
    expect(collection([1, 2], 2, 2, 5)).toEqual({
        data: [1, 2],
        pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
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
        const health = await app.inject({ method: "GET", url: "/api/v1/health" });
        expect(health.statusCode).toBe(200);
        expect(health.json()).toMatchObject({ status: "ok" });
        const ready = await app.inject({ method: "GET", url: "/api/v1/ready" });
        expect(ready.statusCode).toBe(200);
        expect(ready.json()).toMatchObject({ status: "ready" });
        const version = await app.inject({ method: "GET", url: "/api/v1/version" });
        expect(version.statusCode).toBe(200);
        expect(version.json()).toMatchObject({ data: { api: "v1", version: "1.0.0" } });
    } finally {
        await app.close();
    }
}, 30_000);

test("security headers are present on API and HTML responses", async () => {
    const app = await buildApp();
    try {
        for (const url of ["/api/v1/health", "/"]) {
            const response = await app.inject({
                method: "GET",
                url,
                headers: url === "/" ? { accept: "text/html" } : undefined,
            });
            expect(response.headers["x-content-type-options"]).toBe("nosniff");
            expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
            expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
            expect(response.headers["permissions-policy"]).toBe(
                "camera=(), microphone=(), geolocation=()",
            );
        }
    } finally {
        await app.close();
    }
});

test("protected notification routes require authentication while comment listing is public", async () => {
    const app = await buildApp();
    try {
        for (const url of ["/api/v1/me/notifications", "/api/v1/me/notifications/unread-count"]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(401);
        }
        const comments = await app.inject({ method: "GET", url: "/api/v1/posts/missing/comments" });
        expect(comments.statusCode).toBe(200);
        expect(comments.json()).toMatchObject({
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
    } finally {
        await app.close();
    }
});

test("reaction reads reject missing posts and writes require authentication", async () => {
    const app = await buildApp();
    try {
        const read = await app.inject({ method: "GET", url: "/api/v1/posts/missing/reactions" });
        expect(read.statusCode).toBe(404);
        expect(read.json().error.code).toBe("POST_NOT_FOUND");
        const write = await app.inject({ method: "PUT", url: "/api/v1/posts/missing/like" });
        expect(write.statusCode).toBe(401);
    } finally {
        await app.close();
    }
});

test("state-changing requests reject foreign origins", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/me/notifications/read-all",
            headers: { origin: "https://attacker.example" },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("CSRF_ORIGIN_REJECTED");
    } finally {
        await app.close();
    }
});

test("image route rejects invalid transformation parameters", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/posts/image/missing?width=1",
        });
        expect(response.statusCode).toBe(400);
        const placeholder = await app.inject({
            method: "GET",
            url: "/api/v1/posts/image/missing/placeholder",
        });
        expect(placeholder.statusCode).toBe(404);
    } finally {
        await app.close();
    }
});

test("request schemas reject malformed post and user bodies", async () => {
    const app = await buildApp();
    try {
        const post = await app.inject({
            method: "POST",
            url: "/api/v1/posts",
            payload: { title: "", unexpected: true },
        });
        expect(post.statusCode).toBe(400);
        const user = await app.inject({
            method: "POST",
            url: "/api/v1/users",
            payload: { name: "test" },
        });
        expect(user.statusCode).toBe(400);
    } finally {
        await app.close();
    }
});

test("custom emoji listing is public and creation is protected", async () => {
    const app = await buildApp();
    try {
        const list = await app.inject({ method: "GET", url: "/api/v1/emojis" });
        expect(list.statusCode).toBe(200);
        expect(list.json()).toMatchObject({ data: [] });
        const create = await app.inject({
            method: "POST",
            url: "/api/v1/emojis",
            payload: { name: "blobcat", url: "/api/v1/posts/image/example" },
        });
        expect(create.statusCode).toBe(401);
    } finally {
        await app.close();
    }
});

test("public API rejects unsupported methods cleanly", async () => {
    const app = await buildApp();
    try {
        const response = await app.inject({ method: "PATCH", url: "/api/v1/health" });
        expect(response.statusCode).toBe(404);
    } finally {
        await app.close();
    }
});

test("missing API resources return structured errors", async () => {
    const app = await buildApp();
    try {
        for (const url of [
            "/api/v1/posts/missing",
            "/api/v1/tags/missing",
            "/api/v1/categories/missing",
        ]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(404);
            expect(response.json().error).toEqual(
                expect.objectContaining({ code: expect.any(String), message: expect.any(String) }),
            );
        }
    } finally {
        await app.close();
    }
});

test("dedicated HTML error pages are served", async () => {
    const app = await buildApp();
    try {
        for (const [url, status] of [
            ["/does-not-exist", 404],
            ["/api/v1/posts/image/missing?width=1", 400],
        ] as const) {
            const response = await app.inject({
                method: "GET",
                url,
                headers: { accept: "text/html" },
            });
            expect(response.statusCode).toBe(status);
            expect(response.headers["content-type"] ?? "").toMatch(/text\/html/);
        }
    } finally {
        await app.close();
    }
});


test("Bearer API tokens authenticate external API requests and enforce permissions", async () => {
    const app = await buildApp();
    const { generateApiToken } = await import("../src/lib/api-tokens.js");
    const userId = "api-token-test-user";
    await prisma.user.deleteMany({ where: { id: userId } });
    const user = await prisma.user.create({
        data: { id: userId, name: "API Token Test", email: "api-token-test@example.com" },
    });
    const generated = generateApiToken();
    await prisma.apiToken.create({
        data: {
            name: "test client",
            tokenPrefix: generated.prefix,
            tokenHash: generated.hash,
            permissionsJson: JSON.stringify({ me: ["read"] }),
            userId: user.id,
        },
    });

    try {
        const authenticated = await app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: `Bearer ${generated.token}` },
        });
        expect(authenticated.statusCode).toBe(200);
        expect(authenticated.json()).toMatchObject({ data: { id: userId } });

        const denied = await app.inject({
            method: "POST",
            url: "/api/v1/me/preferences",
            headers: {
                authorization: `Bearer ${generated.token}`,
                "content-type": "application/json",
            },
            payload: {},
        });
        expect(denied.statusCode).toBe(403);
        expect(denied.json()).toMatchObject({
            error: { code: "API_TOKEN_PERMISSION_DENIED" },
        });

        const invalid = await app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: "Bearer ims_invalid-token" },
        });
        expect(invalid.statusCode).toBe(401);
        expect(invalid.json()).toMatchObject({
            error: { code: "INVALID_API_TOKEN" },
        });
    } finally {
        await prisma.apiToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
        await app.close();
    }
});


test("recommendations return public posts for anonymous visitors", async () => {
    const app = await buildApp();
    const suffix = "recommendation-anon-" + Date.now().toString(36);
    const userId = `${suffix}-creator`;
    try {
        await prisma.user.create({
            data: {
                id: userId,
                name: "Recommendation Anonymous Creator",
                email: `${suffix}@example.test`,
            },
        });
        const post = await prisma.post.create({
            data: {
                id: `${suffix}-post`,
                title: "Anonymous recommendation candidate",
                userId,
                status: "published",
                visibility: "public",
            },
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/recommendations?limit=10",
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            data: expect.arrayContaining([expect.objectContaining({ id: post.id })]),
        });
    } finally {
        await prisma.post.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
        await app.close();
    }
}, 30_000);

test("personalized recommendations rank recent likes, views, and interests", async () => {
    const app = await buildApp();
    const suffix = "recommendation-" + Date.now().toString(36);
    let userId = "";
    const creatorId = `${suffix}-creator`;
    const email = `${suffix}@example.test`;
    let cookie = "";
    let tagId = "";
    let categoryId = "";

    try {
        await prisma.user.create({
            data: {
                id: creatorId,
                name: "Recommendation Creator",
                email: `${suffix}-creator@example.test`,
                handle: `${suffix.slice(0, 20)}`,
            },
        });

        const signup = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sign-up/email",
            payload: {
                name: "Recommendation Viewer",
                email,
                password: "recommendation-password-123",
            },
        });
        expect([200, 201]).toContain(signup.statusCode);
        const signupCookieHeader = signup.headers["set-cookie"];
        const signupCookies = Array.isArray(signupCookieHeader)
            ? signupCookieHeader
            : signupCookieHeader
              ? [signupCookieHeader]
              : [];
        cookie = signupCookies.map((item) => item.split(";", 1)[0]).join("; ");
        expect(cookie).not.toBe("");

        const viewer = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        expect(viewer).not.toBeNull();
        userId = viewer!.id;

        const tag = await prisma.tag.create({
            data: { name: `${suffix}-interest`, slug: `${suffix}-interest` },
        });
        tagId = tag.id;
        const category = await prisma.category.create({
            data: { name: `${suffix} category`, slug: `${suffix}-category` },
        });
        categoryId = category.id;

        const createPost = async (title: string, options: {
            tags?: string[];
            categoryId?: string | null;
            views?: number;
        }) => {
            const post = await prisma.post.create({
                data: {
                    id: `${suffix}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                    title,
                    userId: creatorId,
                    status: "published",
                    visibility: "public",
                    categoryId: options.categoryId ?? null,
                    tags: options.tags?.length
                        ? {
                              create: options.tags.map((id) => ({ tagId: id })),
                          }
                        : undefined,
                },
            });
            for (let index = 0; index < (options.views ?? 0); index++) {
                await prisma.postView.create({
                    data: {
                        id: `${post.id}-view-${index}`,
                        postId: post.id,
                        userId: null,
                    },
                });
            }
            return post;
        };

        const viewedSource = await createPost("Viewed source", { tags: [tagId] });
        const likedSource = await createPost("Liked source", { tags: [tagId], categoryId });

        const viewedMatch = await createPost("Viewed match", { tags: [tagId] });
        const likedMatch = await createPost("Liked match", { tags: [tagId], categoryId });
        const neutral = await createPost("Neutral candidate", {});
        const ownPost = await prisma.post.create({
            data: {
                id: `${suffix}-own`,
                title: "Own post",
                userId,
                status: "published",
                visibility: "public",
            },
        });

        await prisma.postView.create({
            data: {
                id: `${suffix}-user-view`,
                postId: viewedSource.id,
                userId,
            },
        });
        await prisma.postReaction.create({
            data: {
                userId,
                postId: likedSource.id,
                type: "like",
            },
        });

        await prisma.postTag.create({
            data: { postId: ownPost.id, tagId },
        });

        const preferences = await app.inject({
            method: "PATCH",
            url: "/api/v1/me/preferences",
            headers: { cookie, "content-type": "application/json" },
            payload: {
                interestedTags: [`${suffix}-interest`],
                interestedCategoryIds: [categoryId],
            },
        });
        expect(preferences.statusCode).toBe(200);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/recommendations?limit=100",
            headers: { cookie },
        });
        expect(response.statusCode).toBe(200);

        const ids = response.json().data.map((post: { id: string }) => post.id);
        expect(ids).toContain(viewedMatch.id);
        expect(ids).toContain(likedMatch.id);
        expect(ids).toContain(neutral.id);
        expect(ids).not.toContain(viewedSource.id);
        expect(ids).not.toContain(likedSource.id);
        expect(ids).not.toContain(ownPost.id);

        // The feed intentionally applies exploration and score jitter, so
        // recommendation order is not deterministic between requests.
        expect(ids).toEqual(expect.arrayContaining([likedMatch.id, viewedMatch.id]));
    } finally {
        await prisma.postView.deleteMany({
            where: {
                post: {
                    userId: { in: [userId, creatorId] },
                },
            },
        });
        await prisma.postReaction.deleteMany({ where: { userId } });
        await prisma.post.deleteMany({ where: { userId: { in: [userId, creatorId] } } });
        if (tagId) await prisma.tag.delete({ where: { id: tagId } });
        if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
        await prisma.user.deleteMany({ where: { id: { in: [userId, creatorId] } } });
        await app.close();
    }
}, 30_000);
