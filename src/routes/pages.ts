import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const pageRoutes: FastifyPluginAsync = async (fastify) => {
    const publicDir = path.join(process.cwd(), "public");

    const staticPage = async (reply: FastifyReply, relativePath: string) => {
        const body = await readFile(path.join(publicDir, relativePath), "utf8");
        return reply.type("text/html; charset=utf-8").send(body);
    };

    const redirects: Record<string, string> = {
        "/login": "/account/login/",
        "/signup": "/account/register/",
        "/account": "/account/",
        "/notifications": "/account/notifications/",
        "/account/notifications": "/account/notifications/",
        "/account/profile": "/account/profile/",
        "/account/sessions": "/account/sessions/",
        "/posts": "/posts/",
        "/posts/new": "/posts/new/",
        "/dashboard": "/dashboard/",
        "/dashboard/posts": "/dashboard/posts/",
        "/dashboard/tags": "/dashboard/tags/",
        "/dashboard/categories": "/dashboard/categories/",
        "/dashboard/settings": "/dashboard/settings/",
        "/users": "/users/",
        "/tags": "/tags/",
        "/categories": "/categories/",
        "/search": "/search/",
        "/about": "/about/",
        "/faq": "/faq/",
        "/github": "/github/",
        "/privacy": "/privacy/",
        "/terms": "/terms/",
        "/admin": "/admin/",
    };

    for (const [from, to] of Object.entries(redirects))
        fastify.get(from, async (_request, reply) => reply.redirect(to, 300));

    fastify.get("/account/login/", async (_request, reply) => staticPage(reply, "account/login/index.html"));
    fastify.get("/account/register/", async (_request, reply) => staticPage(reply, "account/register/index.html"));
    fastify.get("/notifications/", async (_request, reply) => staticPage(reply, "account/notifications.html"));

    fastify.get("/users/", async (_request, reply) => staticPage(reply, "users/index.html"));
    fastify.get("/users/:userId", async (_request, reply) => staticPage(reply, "users/view.html"));
    fastify.get("/users/:userId/", async (_request, reply) => staticPage(reply, "users/view.html"));
    fastify.get("/users/:userId/posts", async (_request, reply) => staticPage(reply, "users/posts.html"));
    fastify.get("/users/:userId/posts/", async (_request, reply) => staticPage(reply, "users/posts.html"));

    fastify.get("/tags/", async (_request, reply) => staticPage(reply, "tags/index.html"));
    fastify.get("/tags/:tagId", async (_request, reply) => staticPage(reply, "tags/view.html"));
    fastify.get("/tags/:tagId/", async (_request, reply) => staticPage(reply, "tags/view.html"));
    fastify.get("/tags/:tagId/posts", async (_request, reply) => staticPage(reply, "tags/posts.html"));
    fastify.get("/tags/:tagId/posts/", async (_request, reply) => staticPage(reply, "tags/posts.html"));

    fastify.get("/categories/", async (_request, reply) => staticPage(reply, "categories/index.html"));
    fastify.get("/categories/:categoryId", async (_request, reply) => staticPage(reply, "categories/view.html"));
    fastify.get("/categories/:categoryId/", async (_request, reply) => staticPage(reply, "categories/view.html"));
    fastify.get("/categories/:categoryId/posts", async (_request, reply) => staticPage(reply, "categories/posts.html"));
    fastify.get("/categories/:categoryId/posts/", async (_request, reply) => staticPage(reply, "categories/posts.html"));

    fastify.get("/search/", async (_request, reply) => staticPage(reply, "search/index.html"));
    fastify.get("/about/", async (_request, reply) => staticPage(reply, "about.html"));
    fastify.get("/faq/", async (_request, reply) => staticPage(reply, "faq.html"));
    fastify.get("/github/", async (_request, reply) => staticPage(reply, "github.html"));
    fastify.get("/privacy/", async (_request, reply) => staticPage(reply, "privacy.html"));
    fastify.get("/terms/", async (_request, reply) => staticPage(reply, "terms.html"));
    fastify.get("/admin/", async (_request, reply) => staticPage(reply, "admin/index.html"));
    fastify.get("/dashboard/settings/", async (_request, reply) => staticPage(reply, "dashboard/settings/index.html"));
};
