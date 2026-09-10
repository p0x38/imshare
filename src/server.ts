import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";

import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { prisma } from "./lib/auth.js";

const app = Fastify({ logger: true });
const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(rootDir, "uploads");

await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
await app.register(fastifyStatic, { root: uploadDir, prefix: "/uploads/", decorateReply: false });
await app.register(fastifyStatic, { root: publicDir, prefix: "/", decorateReply: true });

await app.register(authRoutes);
await app.register(apiRoutes);

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · imshare</title><script src="https://cdn.tailwindcss.com"></script></head><body class="min-h-screen bg-zinc-950 text-zinc-100"><header class="border-b border-zinc-800"><nav class="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4"><a class="text-xl font-bold" href="/">imshare</a><a href="/posts/">Posts</a><a href="/users/">Users</a><a href="/tags/">Tags</a><a href="/categories/">Categories</a><a href="/search/">Search</a><span class="flex-1"></span><a href="/account/">Account</a></nav></header><main class="mx-auto max-w-6xl px-6 py-10">${body}</main></body></html>`;
const staticPage = (title: string, text: string) => async (_request: any, reply: any) => reply.type("text/html").send(page(title, `<h1 class="mb-4 text-3xl font-bold">${title}</h1><p class="text-zinc-400">${text}</p>`));

app.get("/", async (_request, reply) => reply.sendFile("index.html"));
app.get("/posts/", staticPage("Posts", "Browse the public archive through the v1 API."));
app.get("/posts/:postId", staticPage("Post", "Post details are loaded from the v1 API."));
app.get("/users/", staticPage("Users", "Browse public users."));
app.get("/users/:userId", staticPage("User", "Public user profile."));
app.get("/users/:userId/posts", staticPage("User Posts", "Posts by this user."));
app.get("/tags/", staticPage("Tags", "Browse archive tags."));
app.get("/tags/:tagId", staticPage("Tag", "Tag information."));
app.get("/tags/:tagId/posts", staticPage("Tagged Posts", "Posts associated with this tag."));
app.get("/categories/", staticPage("Categories", "Browse archive categories."));
app.get("/categories/:categoryId", staticPage("Category", "Category information."));
app.get("/categories/:categoryId/posts", staticPage("Category Posts", "Posts in this category."));
app.get("/search/", staticPage("Search", "Search posts, users, tags, and categories."));
app.get("/account/", staticPage("Account", "Your account overview."));
app.get("/account/login/", staticPage("Login", "Sign in with Better Auth."));
app.get("/account/register/", staticPage("Register", "Create an account with Better Auth."));
app.get("/account/logout/", async (request, reply) => { const response = await fetch(`${request.protocol}://${request.hostname}/v1/auth/sign-out`, { method: "POST", headers: { cookie: request.headers.cookie ?? "" } }); response.headers.forEach((value, key) => reply.header(key, value)); return reply.redirect("/"); });
app.get("/dashboard/", staticPage("Dashboard", "Manage your posts, uploads, tags, and categories."));
app.get("/dashboard/posts/", staticPage("My Posts", "Manage your posts."));
app.get("/dashboard/posts/new/", staticPage("New Post", "Create a new post."));
app.get("/dashboard/posts/:postId/", staticPage("Manage Post", "Manage this post."));
app.get("/dashboard/posts/:postId/edit/", staticPage("Edit Post", "Edit this post."));
app.get("/dashboard/tags/", staticPage("Manage Tags", "Manage tags."));
app.get("/dashboard/categories/", staticPage("Manage Categories", "Manage categories."));
app.get("/dashboard/settings/", staticPage("Settings", "Account and interface settings."));
app.get("/about/", staticPage("About", "About imshare."));
app.get("/privacy/", staticPage("Privacy", "Privacy policy."));
app.get("/terms/", staticPage("Terms", "Terms of service."));

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (reply.sent) return;
  return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error." } });
});

const shutdown = async () => { await app.close(); await prisma.$disconnect(); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ host: "0.0.0.0", port: 3000 });
  app.log.info("imshare listening on http://0.0.0.0:3000");
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}