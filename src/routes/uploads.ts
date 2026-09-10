import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { prisma } from "../lib/auth.js";
import { requireUser, ok } from "../lib/api.js";
import { loadConfig } from "../lib/config.js";

const IMAGE_TYPES = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"],
  [".gif", "image/gif"], [".webp", "image/webp"], [".bmp", "image/bmp"],
  [".avif", "image/avif"],
]);

function hasImageSignature(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case ".png":
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case ".gif":
      return buffer.subarray(0, 6).equals(Buffer.from("GIF87a")) || buffer.subarray(0, 6).equals(Buffer.from("GIF89a"));
    case ".webp":
      return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case ".bmp":
      return buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d;
    case ".avif": {
      if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
      const brands = buffer.subarray(8).toString("ascii");
      return brands.includes("avif") || brands.includes("avis");
    }
    default:
      return false;
  }
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  const config = await loadConfig();
  const uploadDir = path.resolve(process.cwd(), config.storage.uploadDirectory);
  await mkdir(uploadDir, { recursive: true });

  fastify.post("/v1/uploads", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const parts = request.parts({ limits: { files: 1, fileSize: config.storage.maxFileSize, fields: 4 } });
    let saved: { filename: string; originalName: string; mimeType: string; size: number } | undefined;
    try {
      for await (const part of parts) {
        if (part.type !== "file") continue;
        const ext = path.extname(part.filename).toLowerCase();
        const mime = IMAGE_TYPES.get(ext);
        if (!mime || part.mimetype !== mime) {
          part.file.resume();
          return reply.code(400).send({ error: { code: "INVALID_FILE", message: "Unsupported image type." } });
        }
        const filename = `${randomUUID()}${ext}`;
        const destination = path.join(uploadDir, filename);
        await pipeline(part.file, createWriteStream(destination, { flags: "wx" }));
        if (part.file.truncated) {
          await unlink(destination).catch(() => undefined);
          return reply.code(413).send({ error: { code: "FILE_TOO_LARGE", message: "Maximum file size exceeded." } });
        }
        const header = await readFile(destination, { encoding: null });
        if (!hasImageSignature(header.subarray(0, 32), ext)) {
          await unlink(destination).catch(() => undefined);
          return reply.code(400).send({ error: { code: "INVALID_FILE", message: "File content does not match its image type." } });
        }
        saved = { filename, originalName: part.filename, mimeType: part.mimetype, size: Number(part.file.bytesRead) };
      }
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: { code: "UPLOAD_FAILED", message: "Upload failed." } });
    }
    if (!saved) return reply.code(400).send({ error: { code: "NO_FILE", message: "An image file is required." } });
    const upload = await prisma.upload.create({ data: { ...saved, userId: user.id } });
    return reply.code(201).send(ok({ ...upload, url: `/uploads/${encodeURIComponent(upload.filename)}` }));
  });

  fastify.get("/v1/uploads/:uploadId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { uploadId } = request.params as { uploadId: string };
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) return reply.code(404).send({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found." } });
    if (upload.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this upload." } });
    return ok({ ...upload, url: `/uploads/${encodeURIComponent(upload.filename)}` });
  });

  fastify.delete("/v1/uploads/:uploadId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { uploadId } = request.params as { uploadId: string };
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) return reply.code(404).send({ error: { code: "UPLOAD_NOT_FOUND", message: "Upload not found." } });
    if (upload.userId !== user.id) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "You do not own this upload." } });
    if (upload.postId) return reply.code(409).send({ error: { code: "UPLOAD_IN_USE", message: "Upload is attached to a post." } });
    await prisma.upload.delete({ where: { id: uploadId } });
    await unlink(path.join(uploadDir, upload.filename)).catch(() => undefined);
    return reply.code(204).send();
  });
};
