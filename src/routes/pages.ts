import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "../lib/api.js";
import { hasRole } from "../lib/permissions.js";

const reactPage = (entry: string, rootId: string, attributes = "") =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="theme-color" content="#1976d2" /><title>imshare</title><style>html,body{margin:0;min-height:100%}body{background:#fff;color:#111}@media(prefers-color-scheme:dark){body{background:#121212;color:#fff}}#app-loading{min-height:100vh;display:grid;place-items:center;box-sizing:border-box;padding:24px;font:400 14px/1.5 system-ui,sans-serif}#app-loading-content{display:flex;align-items:center;gap:12px;opacity:.72}#app-loading-spinner{width:20px;height:20px;box-sizing:border-box;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:app-loading-spin 700ms linear infinite}@keyframes app-loading-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#app-loading-spinner{animation-duration:1400ms}}</style></head><body ${attributes}><div id="app-loading" role="status" aria-live="polite"><div id="app-loading-content"><span id="app-loading-spinner" aria-hidden="true"></span><span>Loading…</span></div></div><div id="${rootId}"></div><script type="module" src="/client/${entry}.js"></script></body></html>`;

export const pageRoutes: FastifyPluginAsync = async (fastify) => {
    const render =
        (entry: string, rootId: string, attributes?: string) =>
        async (_request: FastifyRequest, reply: FastifyReply) =>
            reply.type("text/html; charset=utf-8").send(reactPage(entry, rootId, attributes));

    const requireAdminPage = (entry: string, rootId: string) => async (request: FastifyRequest, reply: FastifyReply) => {
        const session = await getSession(request);
        if (!session) return reply.redirect("/account/login/", 302);
        const user = await import("../lib/auth.js").then(({ prisma }) => prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
        if (!user || !hasRole(user.role, "admin")) return reply.code(403).send("Forbidden");
        return reply.type("text/html; charset=utf-8").send(reactPage(entry, rootId));
    };
    const requireModeratorPage = (entry: string, rootId: string) => async (request: FastifyRequest, reply: FastifyReply) => {
        const session = await getSession(request);
        if (!session) return reply.redirect("/account/login/", 302);
        const user = await import("../lib/auth.js").then(({ prisma }) => prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
        if (!user || !hasRole(user.role, "moderator")) return reply.code(403).send("Forbidden");
        return reply.type("text/html; charset=utf-8").send(reactPage(entry, rootId));
    };

    const redirects: Record<string, string> = {
        "/login": "/account/login/", "/signup": "/account/register/", "/account": "/account/", "/account/sessions": "/account/",
        "/notifications": "/account/notifications/", "/account/notifications": "/account/notifications/", "/account/profile": "/account/profile/",
        "/posts": "/posts/", "/posts/new": "/posts/new/", "/texts": "/texts/", "/texts/new": "/texts/new/", "/dashboard": "/dashboard/",
        "/dashboard/posts": "/dashboard/posts/", "/dashboard/tags": "/dashboard/tags/", "/dashboard/categories": "/dashboard/categories/", "/dashboard/settings": "/dashboard/settings/",
        "/users": "/users/", "/tags": "/tags/", "/categories": "/categories/", "/search": "/search/", "/about": "/about/", "/faq": "/faq/", "/github": "/github/", "/privacy": "/privacy/", "/terms": "/terms/",
        "/admin": "/admin/", "/admin/users": "/admin/users/", "/admin/posts": "/admin/posts/", "/admin/reports": "/admin/reports/", "/admin/logs": "/admin/logs/", "/admin/settings": "/admin/settings/",
    };
    for (const [from, to] of Object.entries(redirects)) fastify.get(from, async (_request, reply) => reply.redirect(to, 300));

    fastify.get("/", render("home", "home-page"));
    fastify.get("/account/", render("account", "account-page")); fastify.get("/account/sessions/", render("account", "account-page"));
    fastify.get("/account/login/", render("legacy", "legacy-page")); fastify.get("/account/register/", render("legacy", "legacy-page"));
    fastify.get("/notifications/", render("legacy", "legacy-page")); fastify.get("/account/notifications/", render("legacy", "legacy-page")); fastify.get("/account/profile/", render("legacy", "legacy-page"));
    fastify.get("/posts/", render("posts", "posts-page")); fastify.get("/posts/new/", render("postEditor", "post-editor-page")); fastify.get("/posts/:postId", render("post", "post")); fastify.get("/posts/:postId/", render("post", "post"));
    fastify.get("/texts/", render("texts", "texts-page")); fastify.get("/texts/new/", render("text-editor", "text-editor-page")); fastify.get("/texts/:textId", render("text", "text-page")); fastify.get("/texts/:textId/", render("text", "text-page")); fastify.get("/texts/:textId/edit/", render("text-editor", "text-editor-page"));
    fastify.get("/dashboard/", render("dashboard", "dashboard-page")); fastify.get("/dashboard/posts/", render("dashboardPosts", "dashboard-posts-page")); fastify.get("/dashboard/posts/:postId/", render("dashboardPost", "dashboard-post-page")); fastify.get("/dashboard/posts/:postId/edit/", render("postEditor", "post-editor-page"));
    fastify.get("/dashboard/tags/", render("taxonomy", "taxonomy-page", 'data-taxonomy="tags"')); fastify.get("/dashboard/categories/", render("taxonomy", "taxonomy-page", 'data-taxonomy="categories"')); fastify.get("/dashboard/settings/", render("settings", "settings-page"));
    fastify.get("/users/", render("legacy", "legacy-page")); fastify.get("/users/@:handle", render("legacy", "legacy-page")); fastify.get("/users/@:handle/", render("legacy", "legacy-page")); fastify.get("/users/:userId", render("legacy", "legacy-page")); fastify.get("/users/:userId/", render("legacy", "legacy-page")); fastify.get("/users/:userId/posts", render("legacy", "legacy-page")); fastify.get("/users/:userId/posts/", render("legacy", "legacy-page"));
    fastify.get("/tags/", render("legacy", "legacy-page")); fastify.get("/tags/:tagId", render("legacy", "legacy-page")); fastify.get("/tags/:tagId/", render("legacy", "legacy-page")); fastify.get("/tags/:tagId/posts", render("legacy", "legacy-page")); fastify.get("/tags/:tagId/posts/", render("legacy", "legacy-page"));
    fastify.get("/categories/", render("legacy", "legacy-page")); fastify.get("/categories/:categoryId", render("legacy", "legacy-page")); fastify.get("/categories/:categoryId/", render("legacy", "legacy-page")); fastify.get("/categories/:categoryId/posts", render("legacy", "legacy-page")); fastify.get("/categories/:categoryId/posts/", render("legacy", "legacy-page")); fastify.get("/search/", render("legacy", "legacy-page"));
    fastify.get("/about/", render("staticPages", "static-pages", 'data-static-page="about"')); fastify.get("/faq/", render("faq", "faq-page")); fastify.get("/github/", render("staticPages", "static-pages", 'data-static-page="github"')); fastify.get("/github/commits", render("git-commits", "git-commits-page")); fastify.get("/github/commits/", render("git-commits", "git-commits-page")); fastify.get("/privacy/", render("staticPages", "static-pages", 'data-static-page="privacy"')); fastify.get("/terms/", render("staticPages", "static-pages", 'data-static-page="terms"'));
    fastify.get("/admin/", requireAdminPage("admin", "admin-page"));
    fastify.get("/admin/users/", requireAdminPage("admin-users", "admin-users-page"));
    fastify.get("/admin/posts/", requireAdminPage("admin-posts", "admin-posts-page"));
    fastify.get("/admin/reports/", requireModeratorPage("admin-reports", "admin-reports-page"));
    fastify.get("/admin/logs/", requireAdminPage("admin-logs", "admin-logs-page"));
    fastify.get("/admin/settings/", requireAdminPage("admin-settings", "admin-settings-page"));
};
