import type { FastifyPluginAsync, FastifyReply } from "fastify";

const reactPage = (entry: string, rootId: string, attributes = "") => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#1976d2" />
    <title>imshare</title>
</head>
<body ${attributes}>
    <div id="${rootId}"></div>
    <script type="module" src="/client/${entry}.js"></script>
</body>
</html>`;

export const pageRoutes: FastifyPluginAsync = async (fastify) => {
    const render = (entry: string, rootId: string, attributes?: string) =>
        async (_request: unknown, reply: FastifyReply) => reply.type("text/html; charset=utf-8").send(reactPage(entry, rootId, attributes));

    const redirects: Record<string, string> = {
        "/login": "/account/login/",
        "/signup": "/account/register/",
        "/account": "/account/",
        "/notifications": "/account/notifications/",
        "/account/notifications": "/account/notifications/",
        "/account/profile": "/account/profile/",
        "/account/sessions": "/account/",
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

    fastify.get("/account/login/", render("legacy", "legacy-page"));
    fastify.get("/account/register/", render("legacy", "legacy-page"));
    fastify.get("/notifications/", render("legacy", "legacy-page"));
    fastify.get("/account/notifications/", render("legacy", "legacy-page"));
    fastify.get("/account/profile/", render("legacy", "legacy-page"));

    fastify.get("/users/", render("legacy", "legacy-page"));
    fastify.get("/users/:userId", render("legacy", "legacy-page"));
    fastify.get("/users/:userId/", render("legacy", "legacy-page"));
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
    fastify.get("/about/", render("legacy", "legacy-page"));
    fastify.get("/faq/", render("legacy", "legacy-page"));
    fastify.get("/github/", render("legacy", "legacy-page"));
    fastify.get("/privacy/", render("legacy", "legacy-page"));
    fastify.get("/terms/", render("legacy", "legacy-page"));
    fastify.get("/admin/", render("legacy", "legacy-page"));

    fastify.get("/dashboard/tags/", render("taxonomy", "taxonomy-page", 'data-taxonomy="tags"'));
    fastify.get("/dashboard/categories/", render("taxonomy", "taxonomy-page", 'data-taxonomy="categories"'));
};
