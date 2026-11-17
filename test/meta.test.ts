import { afterAll, expect, test } from "vitest";

const { prisma } = await import("../src/lib/auth.js");
const { buildApp } = await import("../src/app.js");

afterAll(async () => {
    await prisma.$disconnect();
});

test("sitemap excludes posts that disable search indexing even when image crawling is allowed", async () => {
    const app = await buildApp();
    const suffix = `sitemap-${Date.now().toString(36)}`;
    const userId = `${suffix}-user`;
    const postId = `${suffix}-noindex`;

    try {
        await prisma.user.create({
            data: {
                id: userId,
                name: "Sitemap Test User",
                email: `${suffix}@example.test`,
                handle: suffix,
                isPublic: true,
                showProfile: true,
                showPosts: true,
                allowSearchEngineIndex: true,
                allowAiCrawler: true,
                allowImageCrawler: true,
                allowCustomCrawler: true,
            },
        });
        await prisma.post.create({
            data: {
                id: postId,
                title: "Non-indexable post",
                userId,
                status: "published",
                visibility: "public",
                permalinkPattern: "user",
                permalinkIdType: "internalId",
                permalinkKey: postId,
                allowSearchEngineIndex: false,
                allowImageCrawler: true,
            },
        });

        const response = await app.inject({ method: "GET", url: "/sitemap.xml" });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/application\/xml/);
        expect(response.body).not.toContain(postId);
    } finally {
        await prisma.post.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
        await app.close();
    }
}, 30_000);
