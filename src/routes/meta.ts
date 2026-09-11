import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { loadConfig } from "../lib/config.js";

function escapeXml(value: string): string {
    return value.replace(
        /[<>&'\"]/g,
        (character) =>
            ({
                "<": "&lt;",
                ">": "&gt;",
                "&": "&amp;",
                "'": "&apos;",
                '\"': "&quot;",
            })[character] ?? character,
    );
}

function absoluteUrl(baseUrl: string, pathname: string): string {
    return `${baseUrl.replace(/\/$/, "")}${pathname}`;
}

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const baseUrl = config.auth.baseUrl!;

    fastify.get("/sitemap.xml", async (_request, reply) => {
        const [users, posts, tags, categories] = await Promise.all([
            prisma.user.findMany({
                where: { isPublic: true, showProfile: true },
                select: { id: true, updatedAt: true },
            }),
            prisma.post.findMany({
                where: { user: { isPublic: true, showPosts: true } },
                select: {
                    id: true,
                    updatedAt: true,
                    uploads: {
                        orderBy: { createdAt: "asc" },
                        take: 1000,
                        select: { id: true },
                    },
                },
            }),
            prisma.tag.findMany({
                select: { slug: true, updatedAt: true },
            }),
            prisma.category.findMany({
                select: { slug: true, updatedAt: true },
            }),
        ]);

        const staticPaths = [
            "/",
            "/posts/",
            "/users/",
            "/tags/",
            "/categories/",
            "/search/",
            "/about/",
            "/faq/",
            "/github/",
            "/privacy/",
            "/terms/",
        ];

        const entries = [
            ...staticPaths.map(
                (pathname) => `<url><loc>${escapeXml(absoluteUrl(baseUrl, pathname))}</loc></url>`,
            ),
            ...users.map(
                (user) =>
                    `<url><loc>${escapeXml(absoluteUrl(baseUrl, `/users/${encodeURIComponent(user.id)}`))}</loc><lastmod>${user.updatedAt.toISOString()}</lastmod></url>`,
            ),
            ...posts.map((post) => {
                const images = post.uploads
                    .map(
                        (upload) =>
                            `<image:image><image:loc>${escapeXml(absoluteUrl(baseUrl, `/v1/posts/image/${encodeURIComponent(upload.id)}`))}</image:loc></image:image>`,
                    )
                    .join("");

                return `<url><loc>${escapeXml(absoluteUrl(baseUrl, `/posts/${encodeURIComponent(post.id)}`))}</loc><lastmod>${post.updatedAt.toISOString()}</lastmod>${images}</url>`;
            }),
            ...tags.map(
                (tag) =>
                    `<url><loc>${escapeXml(absoluteUrl(baseUrl, `/tags/${encodeURIComponent(tag.slug)}`))}</loc><lastmod>${tag.updatedAt.toISOString()}</lastmod></url>`,
            ),
            ...categories.map(
                (category) =>
                    `<url><loc>${escapeXml(absoluteUrl(baseUrl, `/categories/${encodeURIComponent(category.slug)}`))}</loc><lastmod>${category.updatedAt.toISOString()}</lastmod></url>`,
            ),
        ];

        const xml =
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.join("")}</urlset>\n`;

        return reply
            .type("application/xml; charset=utf-8")
            .header("cache-control", "public, max-age=3600")
            .send(xml);
    });

    fastify.get("/robots.txt", async (_request, reply) => {
        const body = [
            "User-agent: *",
            "Allow: /",
            "Disallow: /v1/",
            "Disallow: /dashboard/",
            "Disallow: /account/",
            "Disallow: /admin/",
            `Sitemap: ${absoluteUrl(baseUrl, "/sitemap.xml")}`,
            "",
        ].join("\n");

        return reply
            .type("text/plain; charset=utf-8")
            .header("cache-control", "public, max-age=3600")
            .send(body);
    });
};
