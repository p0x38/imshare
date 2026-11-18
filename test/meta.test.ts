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

test("robots.txt allows public image routes without generating per-upload rules", async () => {
    const app = await buildApp();

    try {
        const response = await app.inject({
            method: "GET",
            url: "/robots.txt",
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain("Disallow: /api/");
        expect(response.body).toContain("Allow: /api/v1/posts/permalink/");

        const groups = response.body.split(/\n{2,}/);
        const googleBotGroup = groups.find((group) => group.startsWith("User-agent: Googlebot\n"));
        const googleImageGroup = groups.find((group) =>
            group.startsWith("User-agent: Googlebot-Image\n"),
        );
        const aiGroup = groups.find((group) => group.startsWith("User-agent: GPTBot\n"));

        expect(googleBotGroup).toContain("Allow: /api/v1/posts/image/");
        expect(googleBotGroup).toContain("Allow: /api/v1/users/*/avatar");
        expect(googleBotGroup).toContain("Allow: /api/v1/avatars/");

        expect(googleImageGroup).toContain("Allow: /api/v1/posts/image/");
        expect(googleImageGroup).toContain("Allow: /api/v1/avatars/");

        expect(aiGroup).not.toContain("Allow: /api/v1/posts/image/");

        expect(response.body).not.toMatch(/(?:Allow|Disallow): \/api\/v1\/posts\/image\/[^\s/]+/);
    } finally {
        await app.close();
    }
}, 30_000);

test("public post pages include server-rendered fallback content", async () => {
    const previousE2e = process.env.IMSHARE_E2E;
    process.env.IMSHARE_E2E = "true";

    const suffix = `ssr-${Date.now().toString(36)}`;
    const userId = `${suffix}-user`;
    const postId = `${suffix}-post`;
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;

    try {
        app = await buildApp();

        await prisma.user.create({
            data: {
                id: userId,
                name: "SSR Test User",
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
                title: `SSR title ${suffix}`,
                description: `SSR description ${suffix}`,
                userId,
                status: "published",
                visibility: "public",
                permalinkPattern: "user",
                permalinkIdType: "internalId",
                permalinkKey: postId,
                allowSearchEngineIndex: true,
            },
        });

        const response = await app.inject({
            method: "GET",
            url: `/${suffix}/${postId}/`,
            headers: { accept: "text/html" },
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('<main id="post-content-fallback">');
        expect(response.body).toContain(`<h1>SSR title ${suffix}</h1>`);
        expect(response.body).toContain(`SSR description ${suffix}`);
    } finally {
        await prisma.post.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
        await app?.close();

        if (previousE2e === undefined) {
            delete process.env.IMSHARE_E2E;
        } else {
            process.env.IMSHARE_E2E = previousE2e;
        }
    }
}, 30_000);
