import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "../lib/api.js";
import { loadConfigSync, resolveBaseUrl } from "../lib/config.js";
import { hasRole } from "../lib/permissions.js";
import { prisma } from "../lib/auth.js";
import { postPermalink } from "../lib/post-permalink.js";

const reactPage = (entry: string, rootId: string, attributes = "") =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="theme-color" content="#1976d2" /><link rel="icon" href="/favicon.svg" type="image/svg+xml" /><title>imshare</title><style>html,body{margin:0;min-height:100%}body{background:#fff;color:#111}@media(prefers-color-scheme:dark){body{background:#121212;color:#fff}}#app-loading{min-height:100vh;display:grid;place-items:center;box-sizing:border-box;padding:24px;font:400 14px/1.5 system-ui,sans-serif}#app-loading-content{display:flex;align-items:center;gap:12px;opacity:.72}#app-loading-spinner{width:20px;height:20px;box-sizing:border-box;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:app-loading-spin 700ms linear infinite}@keyframes app-loading-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#app-loading-spinner{animation-duration:1400ms}}</style></head><body ${attributes}><div id="app-loading" role="status" aria-live="polite"><div id="app-loading-content"><span id="app-loading-spinner" aria-hidden="true"></span><span>Loading…</span></div></div><div id="${rootId}"></div><script type="module" src="/client/${entry}.js"></script></body></html>`;

const baseUrl = resolveBaseUrl(loadConfigSync());
const baseUrlHostname = new URL(baseUrl).hostname.toLowerCase();

function isLocalhost(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/\[|\]/g, "");
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isMaintenanceMode(request: FastifyRequest): boolean {
    if (process.env.IMSHARE_E2E === "true") return false;
    if (process.env.NODE_ENV === "test") return true;

    // A localhost base URL means the public/deployed hostname should show the
    // maintenance page, while direct local development access stays usable.
    return isLocalhost(baseUrlHostname) && !isLocalhost(request.hostname);
}

async function canViewPost(
    request: FastifyRequest,
    post: {
        userId: string;
        status: string;
        visibility: string;
        hiddenAt: Date | null;
        scheduledAt: Date | null;
    },
): Promise<boolean> {
    const session = await getSession(request);
    if (post.userId === session?.user.id) return true;
    return (
        post.status === "published" &&
        (post.visibility === "public" || post.visibility === "unlisted") &&
        !post.hiddenAt &&
        (!post.scheduledAt || post.scheduledAt <= new Date())
    );
}

async function renderPostOrRedirect(request: FastifyRequest, reply: FastifyReply) {
    if (isMaintenanceMode(request)) return maintenancePage(reply);
    const rawPostId = String((request.params as Record<string, unknown>).postId ?? "");
    const id = decodeURIComponent(rawPostId);
    const post = await prisma.post.findUnique({
        where: { id },
        select: {
            id: true,
            title: true,
            createdAt: true,
            customPostId: true,
            permalinkPattern: true,
            permalinkIdType: true,
            permalinkKey: true,
            userId: true,
            status: true,
            visibility: true,
            hiddenAt: true,
            scheduledAt: true,
            user: { select: { id: true, handle: true } },
        },
    });
    if (post && (await canViewPost(request, post))) {
        const currentPath = request.url.split("?", 1)[0] ?? "/";
        const usesInternalPostPath =
            post.permalinkPattern === "posts" &&
            post.permalinkIdType === "internalId" &&
            (currentPath === `/posts/${encodeURIComponent(post.id)}` ||
                currentPath === `/posts/${encodeURIComponent(post.id)}/`);

        if (!usesInternalPostPath) {
            const permalink = postPermalink(post, post.user);
            if (currentPath !== permalink) return reply.redirect(permalink, 302);
        }
    }
    if (!post) {
        const permalinkPost = await prisma.post.findFirst({
            where: { permalinkPattern: "posts", permalinkKey: id },
            select: {
                userId: true,
                status: true,
                visibility: true,
                hiddenAt: true,
                scheduledAt: true,
            },
        });
        if (permalinkPost && (await canViewPost(request, permalinkPost)))
            return reply.redirect("/posts/" + encodeURIComponent(id) + "/", 302);
    }
    return reply.type("text/html; charset=utf-8").send(reactPage("post", "post"));
}

async function renderUserPostPermalink(request: FastifyRequest, reply: FastifyReply) {
    if (isMaintenanceMode(request)) return maintenancePage(reply);
    const params = request.params as { handle: string; key: string };
    const handle = decodeURIComponent(params.handle);
    const key = decodeURIComponent(params.key);
    const post = await prisma.post.findFirst({
        where: {
            permalinkPattern: "user",
            user: { OR: [{ handle }, { id: handle }] },
            OR: [{ permalinkKey: key }, { permalinkIdType: "internalId", id: key }],
        },
        select: {
            id: true,
            title: true,
            createdAt: true,
            customPostId: true,
            permalinkPattern: true,
            permalinkIdType: true,
            permalinkKey: true,
            userId: true,
            status: true,
            visibility: true,
            hiddenAt: true,
            scheduledAt: true,
            user: { select: { id: true, handle: true } },
        },
    });
    if (!post || !(await canViewPost(request, post)))
        return reply.code(404).type("text/plain; charset=utf-8").send("Not found");
    const permalink = postPermalink(post, post.user);
    const currentPath = request.url.split("?", 1)[0] ?? "/";
    if (currentPath !== permalink) return reply.redirect(permalink, 302);
    return reply.type("text/html; charset=utf-8").send(reactPage("post", "post"));
}
const maintenancePage = (reply: FastifyReply) =>
    reply
        .code(503)
        .header("Retry-After", "300")
        .type("text/html; charset=utf-8")
        .send(reactPage("maintenance", "maintenance-page"));

export const pageRoutes: FastifyPluginAsync = async (fastify) => {
    const render =
        (entry: string, rootId: string, attributes?: string) =>
        async (request: FastifyRequest, reply: FastifyReply) => {
            if (isMaintenanceMode(request)) return maintenancePage(reply);
            return reply
                .type("text/html; charset=utf-8")
                .send(reactPage(entry, rootId, attributes));
        };
    const requireAdminPage =
        (entry: string, rootId: string) => async (request: FastifyRequest, reply: FastifyReply) => {
            if (isMaintenanceMode(request)) return maintenancePage(reply);
            const session = await getSession(request);
            if (!session) return reply.redirect("/account/login/", 302);
            const user = await import("../lib/auth.js").then(({ prisma }) =>
                prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
            );
            if (!user || !hasRole(user.role, "admin")) return reply.code(403).send("Forbidden");
            return reply.type("text/html; charset=utf-8").send(reactPage(entry, rootId));
        };
    const requireModeratorPage =
        (entry: string, rootId: string) => async (request: FastifyRequest, reply: FastifyReply) => {
            if (isMaintenanceMode(request)) return maintenancePage(reply);
            const session = await getSession(request);
            if (!session) return reply.redirect("/account/login/", 302);
            const user = await import("../lib/auth.js").then(({ prisma }) =>
                prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
            );
            if (!user || !hasRole(user.role, "moderator")) return reply.code(403).send("Forbidden");
            return reply.type("text/html; charset=utf-8").send(reactPage(entry, rootId));
        };
    const redirects: Record<string, string> = {
        "/login": "/account/login/",
        "/signup": "/account/register/",
        "/account": "/account/",
        "/account/sessions": "/account/",
        "/notifications": "/account/notifications/",
        "/account/notifications": "/account/notifications/",
        "/account/profile": "/account/profile/",
        "/posts": "/posts/",
        "/posts/new": "/posts/new/",
        "/texts": "/texts/",
        "/texts/new": "/texts/new/",
        "/dashboard": "/dashboard/",
        "/dashboard/analytics": "/dashboard/analytics/",
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
        "/badges": "/badges/",
        "/github": "/github/",
        "/privacy": "/privacy/",
        "/terms": "/terms/",
        "/admin": "/admin/",
        "/admin/users": "/admin/users/",
        "/admin/posts": "/admin/posts/",
        "/admin/reports": "/admin/reports/",
        "/admin/logs": "/admin/logs/",
        "/admin/settings": "/admin/settings/",
        "/admin/analytics": "/admin/analytics/",
    };
    for (const [from, to] of Object.entries(redirects))
        fastify.get(from, async (_request, reply) => reply.redirect(to, 300));
    fastify.get("/favicon.svg", async (_request, reply) =>
        reply
            .type("image/svg+xml")
            .send(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1976d2"/><path fill="#fff" d="M16 17h32v8H24v7h20v8H24v7h24v8H16z"/></svg>',
            ),
    );
    fastify.get("/favicon.ico", async (_request, reply) => reply.redirect("/favicon.svg", 302));
    fastify.get("/", render("home", "home-page"));
    fastify.get("/account/", render("account", "account-page"));
    fastify.get("/account/sessions/", render("account", "account-page"));
    fastify.get("/account/login/", render("legacy", "legacy-page"));
    fastify.get("/account/register/", render("legacy", "legacy-page"));
    fastify.get("/notifications/", render("legacy", "legacy-page"));
    fastify.get("/account/notifications/", render("legacy", "legacy-page"));
    fastify.get("/account/profile/", render("legacy", "legacy-page"));
    fastify.get("/posts/", render("posts", "posts-page"));
    fastify.get("/posts/new/", render("post-editor", "post-editor-page"));
    fastify.get("/posts/:postId", renderPostOrRedirect);
    fastify.get("/posts/:postId/", renderPostOrRedirect);
    fastify.get("/texts/", render("texts", "texts-page"));
    fastify.get("/texts/new/", render("text-editor", "text-editor-page"));
    fastify.get("/texts/:textId", render("text", "text-page"));
    fastify.get("/texts/:textId/", render("text", "text-page"));
    fastify.get("/texts/:textId/edit/", render("text-editor", "text-page"));
    fastify.get("/dashboard/", render("dashboard", "dashboard-page"));
    fastify.get("/dashboard/posts/", render("dashboard-posts", "dashboard-posts-page"));
    fastify.get("/dashboard/posts/:postId/", render("dashboard-post", "dashboard-post-page"));
    fastify.get("/dashboard/posts/:postId/edit/", render("post-editor", "post-editor-page"));
    fastify.get("/dashboard/analytics/", render("dashboard-analytics", "dashboard-analytics-page"));
    fastify.get("/dashboard/tags/", render("taxonomy", "taxonomy-page", 'data-taxonomy="tags"'));
    fastify.get(
        "/dashboard/categories/",
        render("taxonomy", "taxonomy-page", 'data-taxonomy="categories"'),
    );
    fastify.get("/dashboard/settings/", render("settings", "settings-page"));
    fastify.get("/:handle/:key", renderUserPostPermalink);
    fastify.get("/:handle/:key/", renderUserPostPermalink);
    fastify.get("/users/", render("legacy", "legacy-page"));
    fastify.get("/users/@:handle", render("profile", "profile-page"));
    fastify.get("/users/@:handle/", render("profile", "profile-page"));
    fastify.get("/users/:userId", render("profile", "profile-page"));
    fastify.get("/users/:userId/", render("profile", "profile-page"));
    fastify.get("/users/:userId/posts", render("legacy", "legacy-page"));
    fastify.get("/users/:userId/posts/", render("legacy", "legacy-page"));
    fastify.get("/tags/", render("legacy", "legacy-page"));
    fastify.get("/tags/:tagId", render("legacy", "legacy-page"));
    fastify.get("/tags/:tagId/", render("legacy", "legacy-page"));
    fastify.get("/tags/:tagId/posts", render("legacy", "legacy-page"));
    fastify.get("/tags/:tagId/posts/", render("legacy", "legacy-page"));
    fastify.get("/categories/", render("legacy", "legacy-page"));
    fastify.get("/categories/:categoryId", render("legacy", "legacy-page"));
    fastify.get("/categories/:categoryId/", render("legacy", "legacy-page"));
    fastify.get("/categories/:categoryId/posts", render("legacy", "legacy-page"));
    fastify.get("/categories/:categoryId/posts/", render("legacy", "legacy-page"));
    fastify.get("/search/", render("legacy", "legacy-page"));
    fastify.get("/about/", render("static-pages", "static-pages", 'data-static-page="about"'));
    fastify.get("/faq/", render("faq", "faq-page"));
    fastify.get("/badges/", render("badges", "badges-page"));
    fastify.get("/github/", render("static-pages", "static-pages", 'data-static-page="github"'));
    fastify.get("/github/commits", render("git-commits", "git-commits-page"));
    fastify.get("/github/commits/", render("git-commits", "git-commits-page"));
    fastify.get("/privacy/", render("static-pages", "static-pages", 'data-static-page="privacy"'));
    fastify.get("/terms/", render("static-pages", "static-pages", 'data-static-page="terms"'));
    fastify.get("/admin/", requireAdminPage("admin", "admin-page"));
    fastify.get("/admin/users/", requireAdminPage("admin-users", "admin-users-page"));
    fastify.get("/admin/posts/", requireAdminPage("admin-posts", "admin-posts-page"));
    fastify.get("/admin/reports/", requireModeratorPage("admin-reports", "admin-reports-page"));
    fastify.get("/admin/logs/", requireAdminPage("admin-logs", "admin-logs-page"));
    fastify.get("/admin/settings/", requireAdminPage("admin-settings", "admin-settings-page"));
    fastify.get("/admin/analytics/", requireAdminPage("admin-analytics", "admin-analytics-page"));
};
