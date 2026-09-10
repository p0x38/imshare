import type { FastifyPluginAsync } from "fastify";
import { mkdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/auth.js";
import { collection, ok, parseOrder, parsePagination, requireUser, getSession } from "../lib/api.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const IMAGE_TYPES = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"],
  [".gif", "image/gif"], [".webp", "image/webp"], [".bmp", "image/bmp"],
  [".avif", "image/avif"],
]);

const postInclude = {
  user: { select: { id: true, name: true, image: true } },
  category: true,
  tags: { include: { tag: true } },
  uploads: true,
} as const;

function postView(post: any) {
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    sourceUrl: post.sourceUrl,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.user,
    category: post.category,
    tags: post.tags.map((x: any) => x.tag),
    uploads: post.uploads.map((x: any) => ({
      id: x.id, filename: x.filename, originalName: x.originalName,
      mimeType: x.mimeType, size: x.size, createdAt: x.createdAt,
      url: `/uploads/${encodeURIComponent(x.filename)}`,
    })),
  };
}

async function findTags(names: string[]) {
  const unique = [...new Set(names.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const result = [];
  for (const name of unique) {
    result.push(await prisma.tag.upsert({
      where: { slug: name.replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || name },
      update: { name },
      create: { name, slug: name.replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || `tag-${randomUUID().slice(0, 8)}` },
    }));
  }
  return result;
}

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await mkdir(UPLOAD_DIR, { recursive: true });

  fastify.get("/v1/health", async () => ({ status: "ok" }));
  fastify.get("/v1/version", async () => ok({ api: "v1", version: "1.0.0" }));

  fastify.get("/v1/me", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    return ok(user);
  });
  fastify.get("/v1/me/posts", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const q = request.query as Record<string, unknown>; const p = parsePagination(q);
    const where = { userId: user.id };
    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }),
      prisma.post.count({ where }),
    ]);
    return collection(items.map(postView), p.page, p.limit, total);
  });

  fastify.get("/v1/users", async (request) => {
    const q = request.query as Record<string, unknown>; const p = parsePagination(q);
    const search = typeof q.search === "string" ? q.search : undefined;
    const where = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) }, select: { id: true, name: true, image: true, createdAt: true, _count: { select: { posts: true } } } }),
      prisma.user.count({ where }),
    ]);
    return collection(users, p.page, p.limit, total);
  });
  fastify.post("/v1/users", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const body = request.body as { name?: string; email?: string; image?: string };
    if (!body.name || !body.email) return reply.code(400).send({ error: { code: "INVALID_USER", message: "name and email are required." } });
    return reply.code(201).send(ok(await prisma.user.create({ data: { id: randomUUID(), name: body.name, email: body.email, image: body.image } })));
  });
  fastify.get("/v1/users/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, image: true, createdAt: true, _count: { select: { posts: true } } } });
    if (!user) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
    return ok(user);
  });
  fastify.patch("/v1/users/:userId", async (request, reply) => {
    const me = await requireUser(request, reply); if (!me) return;
    const { userId } = request.params as { userId: string }; if (me.id !== userId) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot modify this user." } });
    const body = request.body as { name?: string; image?: string | null };
    return ok(await prisma.user.update({ where: { id: userId }, data: { name: body.name, image: body.image } }));
  });
  fastify.delete("/v1/users/:userId", async (request, reply) => {
    const me = await requireUser(request, reply); if (!me) return;
    const { userId } = request.params as { userId: string }; if (me.id !== userId) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You cannot delete this user." } });
    await prisma.user.delete({ where: { id: userId } }); return reply.code(204).send();
  });
  fastify.get("/v1/users/:userId/posts", async (request, reply) => {
    const { userId } = request.params as { userId: string }; const q = request.query as Record<string, unknown>; const p = parsePagination(q);
    const where = { userId }; const [items, total] = await Promise.all([prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }), prisma.post.count({ where })]);
    return collection(items.map(postView), p.page, p.limit, total);
  });

  fastify.get("/v1/posts", async (request) => {
    const q = request.query as Record<string, unknown>; const p = parsePagination(q);
    const where: any = {};
    if (typeof q.user === "string") where.userId = q.user;
    if (typeof q.category === "string") where.categoryId = q.category;
    if (typeof q.tag === "string") where.tags = { some: { tag: { slug: q.tag } } };
    if (typeof q.search === "string") where.OR = [{ title: { contains: q.search } }, { description: { contains: q.search } }];
    const [items, total] = await Promise.all([prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }), prisma.post.count({ where })]);
    return collection(items.map(postView), p.page, p.limit, total);
  });
  fastify.post("/v1/posts", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const body = request.body as { title?: string; description?: string; sourceUrl?: string; tags?: string[]; categoryId?: string | null; uploadIds?: string[] };
    if (!body.title?.trim()) return reply.code(400).send({ error: { code: "INVALID_POST", message: "title is required." } });
    const tags = await findTags(body.tags ?? []);
    const post = await prisma.post.create({ data: { title: body.title.trim(), description: body.description, sourceUrl: body.sourceUrl, categoryId: body.categoryId, userId: user.id, tags: { create: tags.map((tag) => ({ tagId: tag.id })) }, uploads: body.uploadIds?.length ? { connect: body.uploadIds.map((id) => ({ id })) } : undefined }, include: postInclude });
    return reply.code(201).send(ok(postView(post)));
  });
  fastify.get("/v1/posts/:postId", async (request, reply) => {
    const { postId } = request.params as { postId: string }; const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); return ok(postView(post));
  });
  fastify.patch("/v1/posts/:postId", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return;
    const { postId } = request.params as { postId: string }; const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); if (existing.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } });
    const body = request.body as { title?: string; description?: string; sourceUrl?: string | null; categoryId?: string | null; tags?: string[] };
    if (body.tags) await prisma.postTag.deleteMany({ where: { postId } }); const tags = body.tags ? await findTags(body.tags) : [];
    const post = await prisma.post.update({ where: { id: postId }, data: { title: body.title, description: body.description, sourceUrl: body.sourceUrl, categoryId: body.categoryId, ...(body.tags ? { tags: { create: tags.map((tag) => ({ tagId: tag.id })) } } : {}) }, include: postInclude });
    return ok(postView(post));
  });
  fastify.delete("/v1/posts/:postId", async (request, reply) => {
    const user = await requireUser(request, reply); if (!user) return; const { postId } = request.params as { postId: string }; const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } }); await prisma.post.delete({ where: { id: postId } }); return reply.code(204).send();
  });

  fastify.get("/v1/posts/:postId/tags", async (request, reply) => { const { postId } = request.params as { postId: string }; return ok(await prisma.postTag.findMany({ where: { postId }, include: { tag: true } }).then((x) => x.map((y) => y.tag))); });
  fastify.post("/v1/posts/:postId/tags", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { postId } = request.params as { postId: string }; const body = request.body as { tagId?: string }; const post = await prisma.post.findUnique({ where: { id: postId } }); if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } }); if (!body.tagId) return reply.code(400).send({ error: { code: "INVALID_TAG", message: "tagId is required." } }); return reply.code(201).send(ok(await prisma.postTag.upsert({ where: { postId_tagId: { postId, tagId: body.tagId } }, update: {}, create: { postId, tagId: body.tagId }, include: { tag: true } }).then((x) => x.tag))); });
  fastify.delete("/v1/posts/:postId/tags/:tagId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { postId, tagId } = request.params as { postId: string; tagId: string }; const post = await prisma.post.findUnique({ where: { id: postId } }); if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } }); await prisma.postTag.delete({ where: { postId_tagId: { postId, tagId } } }).catch(() => undefined); return reply.code(204).send(); });
  fastify.get("/v1/posts/:postId/category", async (request, reply) => { const { postId } = request.params as { postId: string }; const post = await prisma.post.findUnique({ where: { id: postId }, include: { category: true } }); if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); return ok(post.category); });
  fastify.put("/v1/posts/:postId/category", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { postId } = request.params as { postId: string }; const body = request.body as { categoryId?: string }; const post = await prisma.post.findUnique({ where: { id: postId } }); if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } }); return ok(await prisma.post.update({ where: { id: postId }, data: { categoryId: body.categoryId }, include: { category: true } }).then((x) => x.category)); });
  fastify.delete("/v1/posts/:postId/category", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { postId } = request.params as { postId: string }; const post = await prisma.post.findUnique({ where: { id: postId } }); if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "Post not found." } }); if (post.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this post." } }); await prisma.post.update({ where: { id: postId }, data: { categoryId: null } }); return reply.code(204).send(); });

  fastify.get("/v1/tags", async (request) => { const q = request.query as Record<string, unknown>; const p = parsePagination(q); const where = typeof q.search === "string" ? { name: { contains: q.search } } : {}; const [items, total] = await Promise.all([prisma.tag.findMany({ where, skip: p.skip, take: p.limit, orderBy: { name: parseOrder(q.order) }, include: { _count: { select: { posts: true } } } }), prisma.tag.count({ where })]); return collection(items, p.page, p.limit, total); });
  fastify.post("/v1/tags", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const body = request.body as { name?: string; slug?: string }; if (!body.name || !body.slug) return reply.code(400).send({ error: { code: "INVALID_TAG", message: "name and slug are required." } }); return reply.code(201).send(ok(await prisma.tag.create({ data: { name: body.name, slug: body.slug } }))); });
  fastify.get("/v1/tags/:tagId", async (request, reply) => { const { tagId } = request.params as { tagId: string }; const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { _count: { select: { posts: true } } } }); if (!tag) return reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "Tag not found." } }); return ok(tag); });
  fastify.patch("/v1/tags/:tagId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { tagId } = request.params as { tagId: string }; return ok(await prisma.tag.update({ where: { id: tagId }, data: request.body as { name?: string; slug?: string } })); });
  fastify.delete("/v1/tags/:tagId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { tagId } = request.params as { tagId: string }; await prisma.tag.delete({ where: { id: tagId } }); return reply.code(204).send(); });
  fastify.get("/v1/tags/:tagId/posts", async (request, reply) => { const { tagId } = request.params as { tagId: string }; const q = request.query as Record<string, unknown>; const p = parsePagination(q); const where = { tags: { some: { tagId } } }; const [items, total] = await Promise.all([prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }), prisma.post.count({ where })]); return collection(items.map(postView), p.page, p.limit, total); });

  fastify.get("/v1/categories", async (request) => { const q = request.query as Record<string, unknown>; const p = parsePagination(q); const [items, total] = await Promise.all([prisma.category.findMany({ skip: p.skip, take: p.limit, orderBy: { name: parseOrder(q.order) }, include: { _count: { select: { posts: true } } } }), prisma.category.count()]); return collection(items, p.page, p.limit, total); });
  fastify.post("/v1/categories", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; return reply.code(201).send(ok(await prisma.category.create({ data: request.body as { name: string; slug: string; description?: string } }))); });
  fastify.get("/v1/categories/:categoryId", async (request, reply) => { const { categoryId } = request.params as { categoryId: string }; const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { _count: { select: { posts: true } } } }); if (!category) return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "Category not found." } }); return ok(category); });
  fastify.patch("/v1/categories/:categoryId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { categoryId } = request.params as { categoryId: string }; return ok(await prisma.category.update({ where: { id: categoryId }, data: request.body as { name?: string; slug?: string; description?: string } })); });
  fastify.delete("/v1/categories/:categoryId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { categoryId } = request.params as { categoryId: string }; await prisma.category.delete({ where: { id: categoryId } }); return reply.code(204).send(); });
  fastify.get("/v1/categories/:categoryId/posts", async (request, reply) => { const { categoryId } = request.params as { categoryId: string }; const q = request.query as Record<string, unknown>; const p = parsePagination(q); const where = { categoryId }; const [items, total] = await Promise.all([prisma.post.findMany({ where, include: postInclude, skip: p.skip, take: p.limit, orderBy: { createdAt: parseOrder(q.order) } }), prisma.post.count({ where })]); return collection(items.map(postView), p.page, p.limit, total); });

  fastify.get("/v1/search", async (request) => { const q = request.query as Record<string, unknown>; const p = parsePagination(q); const term = typeof q.q === "string" ? q.q : ""; const type = typeof q.type === "string" ? q.type : "all"; const result: any = {}; if (type === "posts" || type === "all") result.posts = (await prisma.post.findMany({ where: term ? { OR: [{ title: { contains: term } }, { description: { contains: term } }] } : {}, take: p.limit, include: postInclude })).map(postView); if (type === "users" || type === "all") result.users = await prisma.user.findMany({ where: term ? { name: { contains: term } } : {}, take: p.limit, select: { id: true, name: true, image: true } }); if (type === "tags" || type === "all") result.tags = await prisma.tag.findMany({ where: term ? { name: { contains: term } } : {}, take: p.limit }); if (type === "categories" || type === "all") result.categories = await prisma.category.findMany({ where: term ? { name: { contains: term } } : {}, take: p.limit }); return ok(result); });

  fastify.post("/v1/uploads", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const parts = request.parts({ limits: { files: 1, fileSize: 25 * 1024 * 1024, fields: 4 } }); let saved: { filename: string; originalName: string; mimeType: string; size: number } | undefined; try { for await (const part of parts) { if (part.type !== "file") continue; const ext = path.extname(part.filename).toLowerCase(); const mime = IMAGE_TYPES.get(ext); if (!mime || part.mimetype !== mime) { part.file.resume(); return reply.code(400).send({ error: { code: "INVALID_FILE", message: "Unsupported image type." } }); } const filename = `${randomUUID()}${ext}`; const destination = path.join(UPLOAD_DIR, filename); await pipeline(part.file, createWriteStream(destination, { flags: "wx" })); if (part.file.truncated) { await unlink(destination).catch(() => undefined); return reply.code(413).send({ error: { code: "FILE_TOO_LARGE", message: "Maximum file size is 25 MiB." } }); } saved = { filename, originalName: part.filename, mimeType: part.mimetype, size: Number(part.file.bytesRead) }; } } catch (error) { request.log.error(error); return reply.code(500).send({ error: { code: "UPLOAD_FAILED", message: "Upload failed." } }); } if (!saved) return reply.code(400).send({ error: { code: "NO_FILE", message: "An image file is required." } }); const upload = await prisma.upload.create({ data: { ...saved, userId: user.id } }); return reply.code(201).send(ok({ ...upload, url: `/uploads/${encodeURIComponent(upload.filename)}` })); });
  fastify.get("/v1/uploads/:uploadId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { uploadId } = request.params as { uploadId: string }; const upload = await prisma.upload.findUnique({ where: { id: uploadId } }); if (!upload) return reply.code(404).send({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found." } }); if (upload.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this upload." } }); return ok({ ...upload, url: `/uploads/${encodeURIComponent(upload.filename)}` }); });
  fastify.delete("/v1/uploads/:uploadId", async (request, reply) => { const user = await requireUser(request, reply); if (!user) return; const { uploadId } = request.params as { uploadId: string }; const upload = await prisma.upload.findUnique({ where: { id: uploadId } }); if (!upload) return reply.code(404).send({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found." } }); if (upload.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this upload." } }); if (upload.postId) return reply.code(409).send({ error: { code: "UPLOAD_IN_USE", message: "Upload is attached to a post." } }); await prisma.upload.delete({ where: { id: uploadId } }); await unlink(path.join(UPLOAD_DIR, upload.filename)).catch(() => undefined); return reply.code(204).send(); });
};