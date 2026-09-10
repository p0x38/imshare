import type { FastifyPluginAsync } from "fastify";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/auth.js";
import { loadConfig } from "../lib/config.js";
import { queueThumbnailGeneration } from "../lib/thumbnails.js";

const MAX_DIMENSION = 4096; const MIN_DIMENSION = 16;
const FORMATS = { webp: { mime: "image/webp" }, jpeg: { mime: "image/jpeg" }, jpg: { mime: "image/jpeg" }, png: { mime: "image/png" }, avif: { mime: "image/avif" } } as const;
type ImageFormat = keyof typeof FORMATS; type Fit = "cover" | "contain" | "fill" | "inside" | "outside";
function parseDimension(value: unknown): number | undefined { if (value === undefined || value === "") return undefined; const dimension = Number(value); if (!Number.isInteger(dimension) || dimension < MIN_DIMENSION || dimension > MAX_DIMENSION) throw new Error("INVALID_DIMENSION"); return dimension; }
function parseFit(value: unknown): Fit { if (value === undefined || value === "") return "inside"; if (["cover", "contain", "fill", "inside", "outside"].includes(String(value))) return value as Fit; throw new Error("INVALID_FIT"); }
function parseFormat(value: unknown): ImageFormat | undefined { if (value === undefined || value === "") return undefined; if (typeof value !== "string" || !(value in FORMATS)) throw new Error("INVALID_FORMAT"); return value as ImageFormat; }
function cacheKey(uploadId: string, width?: number, height?: number, fit?: Fit, format?: ImageFormat) { return `${uploadId}-${width ?? "auto"}x${height ?? "auto"}-${fit ?? "inside"}.${format ?? "source"}`; }

export const imageRoutes: FastifyPluginAsync = async (fastify) => {
  const config = await loadConfig(); const uploadDir = path.resolve(process.cwd(), config.storage.uploadDirectory); const cacheDir = path.join(uploadDir, ".cache"); await mkdir(cacheDir, { recursive: true });
  fastify.get("/v1/posts/image/:uploadId", async (request, reply) => {
    const { uploadId } = request.params as { uploadId: string }; const query = request.query as Record<string, unknown>;
    const upload = await prisma.upload.findUnique({ where: { id: uploadId }, include: { post: { select: { allowDownload: true, userId: true } } } });
    if (!upload) return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
    const source = path.resolve(uploadDir, upload.filename); const relative = path.relative(uploadDir, source); if (relative.startsWith("..") || path.isAbsolute(relative)) return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image not found." } });
    try { await access(source); } catch { return reply.code(404).send({ error: { code: "IMAGE_NOT_FOUND", message: "Image file not found." } }); }
    let width: number | undefined; let height: number | undefined; let fit: Fit; let format: ImageFormat | undefined;
    try { width = parseDimension(query.width); height = parseDimension(query.height); fit = parseFit(query.fit); format = parseFormat(query.format); } catch (error) { const code = error instanceof Error ? error.message : "INVALID_IMAGE_PARAMETER"; return reply.code(400).send({ error: { code, message: "Invalid image transformation parameters." } }); }
    const transformed = width !== undefined || height !== undefined || format !== undefined;
    if (query.download === "true" && upload.post && !upload.post.allowDownload) return reply.code(403).send({ error: { code: "DOWNLOAD_DISABLED", message: "The creator has disabled downloads for this image." } });
    reply.header("Cache-Control", "public, max-age=31536000, immutable"); reply.header("X-Content-Type-Options", "nosniff");
    if (!transformed) { reply.type(upload.mimeType); if (query.download === "true") reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`); return reply.send(createReadStream(source)); }
    const key = cacheKey(upload.id, width, height, fit, format); const cached = path.join(cacheDir, key);
    try { const output = await readFile(cached); reply.type(format ? FORMATS[format].mime : upload.mimeType); return reply.send(output); } catch {}
    try {
      if (width !== undefined && height === undefined && fit === "inside" && format === "webp" && [320, 640, 1280].includes(width)) queueThumbnailGeneration(source, cacheDir, upload.id);
      let pipeline = sharp(source, { animated: false }); if (width !== undefined || height !== undefined) pipeline = pipeline.resize({ width, height, fit, withoutEnlargement: true });
      if (format !== undefined) { pipeline = pipeline.toFormat(format === "jpg" ? "jpeg" : format); reply.type(FORMATS[format].mime); } else reply.type(upload.mimeType);
      const output = await pipeline.toBuffer(); await writeFile(cached, output, { flag: "wx" }).catch(async (error) => { if ((error as NodeJS.ErrnoException).code === "EEXIST") return; throw error; }); return reply.send(output);
    } catch (error) { request.log.error(error); return reply.code(415).send({ error: { code: "IMAGE_PROCESSING_FAILED", message: "The image could not be processed." } }); }
  });
};
