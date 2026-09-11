import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../lib/auth.js";
import { loadConfig, resolveBaseUrl } from "../lib/config.js";

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
    const baseUrl = resolveBaseUrl(config);

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
            prisma.tag.findMany({ select: { slug: true, updatedAt: true } }),
            prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
        ]);

        const urls = [
            { loc: absoluteUrl(baseUrl, "/"), lastmod: new Date() },
            ...users.map((user) => ({ loc: absoluteUrl(baseUrl, `/users/${encodeURIComponent(user.id)}`), lastmod: user.updatedAt })),
            ...posts.map((post) => ({ loc: absoluteUrl(baseUrl, `/posts/${encodeURIComponent(post.id)}`), lastmod: post.updatedAt })),
            ...tags.map((tag) => ({ loc: absoluteUrl(baseUrl, `/tags/${encodeURIComponent(tag.slug)}`), lastmod: tag.updatedAt })),
            ...categories.map((category) => ({ loc: absoluteUrl(baseUrl, `/categories/${encodeURIComponent(category.slug)}`), lastmod: category.updatedAt })),
        ];
        const body = urls
            .map(({ loc, lastmod }) => `<url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod.toISOString()}</lastmod></url>`)
            .join("");
        return reply
            .type("application/xml; charset=utf-8")
            .send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
    });
};
