import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { loadConfig } from "../lib/config.js";
import { openapi } from "../lib/openapi-route.js";
import { postPermalink } from "../lib/post-permalink.js";
import {
    CRAWLER_USER_AGENTS,
    resolveCrawlerPolicy,
    type CrawlerCategory,
} from "../lib/crawler-policy.js";

function escapeXml(value: string): string {
    return value.replace(
        /[<>&'\"]/g,
        (character) =>
            ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[
                character
            ] ?? character,
    );
}
function absoluteUrl(baseUrl: string, pathname: string): string {
    return `${baseUrl.replace(/\/$/, "")}${pathname}`;
}

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
    const config = await loadConfig();
    const baseUrl = config.auth.baseUrl!;

    fastify.get(
        "/sitemap.xml",
        {
            schema: openapi({
                tags: "Public Endpoint",
                summary: "Get sitemap",
                description: "Generates the XML sitemap for public site resources.",
                operationId: "getSitemap",
                responses: { "200": { description: "XML sitemap document." } },
            }),
        },
        async (_request, reply) => {
            const [users, posts, tags, categories] = await Promise.all([
                prisma.user.findMany({
                    where: { isPublic: true, showProfile: true },
                    select: {
                        id: true,
                        handle: true,
                        updatedAt: true,
                        allowSearchEngineIndex: true,
                        allowAiCrawler: true,
                        allowImageCrawler: true,
                        allowCustomCrawler: true,
                    },
                }),
                prisma.post.findMany({
                    where: {
                        status: "published",
                        visibility: "public",
                        user: { isPublic: true, showPosts: true },
                    },
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                        customPostId: true,
                        permalinkPattern: true,
                        permalinkIdType: true,
                        permalinkKey: true,
                        updatedAt: true,
                        user: {
                            select: {
                                id: true,
                                handle: true,
                                allowSearchEngineIndex: true,
                                allowAiCrawler: true,
                                allowImageCrawler: true,
                                allowCustomCrawler: true,
                            },
                        },
                        uploads: {
                            orderBy: { createdAt: "asc" },
                            take: 1000,
                            select: { id: true },
                        },
                        allowSearchEngineIndex: true,
                        allowAiCrawler: true,
                        allowImageCrawler: true,
                        allowCustomCrawler: true,
                    },
                }),
                prisma.tag.findMany({ select: { slug: true, updatedAt: true } }),
                prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
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
                    (pathname) =>
                        `<url><loc>${escapeXml(absoluteUrl(baseUrl, pathname))}</loc></url>`,
                ),
                ...users
                    .filter((user) => resolveCrawlerPolicy(user).search)
                    .map((user) => {
                        const pathname = user.handle
                            ? `/users/@${encodeURIComponent(user.handle)}`
                            : `/users/${encodeURIComponent(user.id)}`;
                        return `<url><loc>${escapeXml(absoluteUrl(baseUrl, pathname))}</loc><lastmod>${user.updatedAt.toISOString()}</lastmod></url>`;
                    }),
                ...posts
                    .filter((post) => {
                        const policy = resolveCrawlerPolicy(post.user, post);
                        return policy.search || policy.image;
                    })
                    .map((post) => {
                        const policy = resolveCrawlerPolicy(post.user, post);

                        const images = policy.image
                            ? post.uploads
                                  .map(
                                      (upload) =>
                                          `<image:image><image:loc>${escapeXml(absoluteUrl(baseUrl, `/api/v1/posts/image/${encodeURIComponent(upload.id)}`))}</image:loc></image:image>`,
                                  )
                                  .join("")
                            : "";
                        const pathname = postPermalink(post, post.user);
                        return `<url><loc>${escapeXml(absoluteUrl(baseUrl, pathname))}</loc><lastmod>${post.updatedAt.toISOString()}</lastmod>${images}</url>`;
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
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.join("")}</urlset>\n`;
            return reply
                .type("application/xml; charset=utf-8")
                .header("cache-control", "public, max-age=3600")
                .send(xml);
        },
    );

    fastify.get(
        "/robots.txt",
        {
            schema: openapi({
                tags: "Public Endpoint",
                summary: "Get robots.txt",
                description: "Returns crawler-specific directives for public users and posts.",
                operationId: "getRobotsTxt",
                responses: { "200": { description: "Robots exclusion document." } },
            }),
        },
        async (_request, reply) => {
            const users = await prisma.user.findMany({
                where: {
                    isPublic: true,
                    showProfile: true,
                    isBanned: false,
                },
                select: {
                    id: true,
                    handle: true,

                    allowSearchEngineIndex: true,
                    allowAiCrawler: true,
                    allowImageCrawler: true,
                    allowCustomCrawler: true,

                    posts: {
                        where: {
                            status: "published",
                            visibility: "public",
                            hiddenAt: null,
                            OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
                        },
                        select: {
                            id: true,
                            title: true,
                            createdAt: true,
                            customPostId: true,
                            permalinkPattern: true,
                            permalinkIdType: true,
                            permalinkKey: true,
                            thumbnailUploadId: true,

                            allowSearchEngineIndex: true,
                            allowAiCrawler: true,
                            allowImageCrawler: true,
                            allowCustomCrawler: true,

                            uploads: {
                                select: {
                                    id: true,
                                },
                            },
                        },
                    },
                },
            });

            const groups: {
                userAgent: string;
                category: CrawlerCategory;
            }[] = [
                ...CRAWLER_USER_AGENTS.search.map((userAgent) => ({
                    userAgent,
                    category: "search" as const,
                })),
                ...CRAWLER_USER_AGENTS.ai.map((userAgent) => ({
                    userAgent,
                    category: "ai" as const,
                })),
                ...CRAWLER_USER_AGENTS.image.map((userAgent) => ({
                    userAgent,
                    category: "image" as const,
                })),
                ...CRAWLER_USER_AGENTS.custom.map((userAgent) => ({
                    userAgent,
                    category: "custom" as const,
                })),

                {
                    userAgent: "*",
                    category: "custom",
                },
            ];

            const lines: string[] = [];

            for (const group of groups) {
                const disallowed = new Set<string>();
                const allowed = new Set<string>(["/api/v1/posts/image/"]);

                for (const user of users) {
                    const userPolicy = resolveCrawlerPolicy(user);

                    const profilePath = user.handle
                        ? `/users/@${encodeURIComponent(user.handle)}`
                        : `/users/${encodeURIComponent(user.id)}`;

                    if (group.category !== "image" && !userPolicy[group.category]) {
                        disallowed.add(profilePath);
                    }

                    const avatarPath = `/api/v1/users/${encodeURIComponent(user.id)}/avatar`;

                    if (userPolicy.image) {
                        allowed.add(avatarPath);
                    } else {
                        disallowed.add(avatarPath);
                    }

                    for (const post of user.posts) {
                        const policy = resolveCrawlerPolicy(user, post);

                        if (group.category !== "image" && !policy[group.category]) {
                            disallowed.add(postPermalink(post, user));
                        }

                        if (!policy.image) {
                            const uploadIds = new Set([
                                ...post.uploads.map((upload) => upload.id),
                                ...(post.thumbnailUploadId ? [post.thumbnailUploadId] : []),
                            ]);

                            for (const uploadId of uploadIds) {
                                disallowed.add(
                                    `/api/v1/posts/image/${encodeURIComponent(uploadId)}`,
                                );
                            }
                        }
                    }
                }

                lines.push(
                    `User-agent: ${group.userAgent}`,
                    "Disallow: /api/",
                    "Disallow: /account/",
                    "Disallow: /dashboard/",
                    "Disallow: /admin/",
                    "Disallow: /notifications/",
                    "Disallow: /login",
                    "Disallow: /signup",
                    ...[...allowed].map((pathname) => `Allow: ${pathname}`),
                    ...[...disallowed].map((pathname) => `Disallow: ${pathname}`),
                    "",
                );
            }

            lines.push(`Sitemap: ${absoluteUrl(baseUrl, "/sitemap.xml")}`, "");

            return reply
                .type("text/plain; charset=utf-8")
                .header("cache-control", "public, max-age=300")
                .send(lines.join("\n"));
        },
    );
};
