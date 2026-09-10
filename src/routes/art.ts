import type {
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import { auth, prisma } from "../lib/auth.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

type AuthenticatedRequest = FastifyRequest & {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
  };
};

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".avif",
]);

function getSafeExtension(filename: string): string {
  const extension = path.extname(filename).toLowerCase();

  if (!IMAGE_EXTENSIONS.has(extension)) {
    return ".bin";
  }

  return extension;
}

function getFilename(filename: string): string {
  return `${randomUUID()}${getSafeExtension(filename)}`;
}

function isImageFilename(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(
    path.extname(filename).toLowerCase(),
  );
}

export const artRoutes: FastifyPluginAsync = async (fastify) => {
  await mkdir(UPLOAD_DIR, { recursive: true });

  fastify.addHook("onRequest", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as HeadersInit,
    });

    if (!session) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
    }

    (request as AuthenticatedRequest).user = session.user;
  });

  fastify.post("/api/upload", async (request, reply) => {
    const userRequest = request as AuthenticatedRequest;

    const parts = request.parts({
      limits: {
        files: 1,
        fileSize: 25 * 1024 * 1024,
        fields: 10,
      },
    });

    let savedFilename: string | undefined;
    let sourceUrl = "";
    let tags = "";

    try {
      for await (const part of parts) {
        if (part.type === "file") {
          if (!isImageFilename(part.filename)) {
            part.file.resume();

            return reply.code(400).send({
              error: "Invalid file type",
              message:
                "Only common image formats are supported.",
            });
          }

          const filename = getFilename(part.filename);
          const destination = path.join(
            UPLOAD_DIR,
            filename,
          );

          await pipeline(
            part.file,
            createWriteStream(destination, {
              flags: "wx",
            }),
          );

          if (part.file.truncated) {
            await import("node:fs/promises").then(({ unlink }) =>
              unlink(destination).catch(() => undefined),
            );

            return reply.code(413).send({
              error: "File too large",
              message: "Maximum file size is 25 MiB.",
            });
          }

          savedFilename = filename;
        } else if (part.fieldname === "sourceUrl") {
          sourceUrl = String(part.value ?? "").trim();
        } else if (part.fieldname === "tags") {
          tags = String(part.value ?? "").trim();
        }
      }
    } catch (error) {
      request.log.error(error, "Failed to save uploaded artwork");

      return reply.code(500).send({
        error: "Upload failed",
      });
    }

    if (!savedFilename) {
      return reply.code(400).send({
        error: "No image uploaded",
        message: "An image file is required.",
      });
    }

    if (sourceUrl.length > 2048) {
      return reply.code(400).send({
        error: "Invalid source URL",
        message: "The source URL is too long.",
      });
    }

    const normalizedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, array) =>
        array.indexOf(tag) === index,
      )
      .join(",");

    try {
      const artwork = await prisma.artwork.create({
        data: {
          filename: savedFilename,
          sourceUrl: sourceUrl || null,
          tags: normalizedTags,
          userId: userRequest.user.id,
        },
      });

      return reply.code(201).send({
        id: artwork.id,
        filename: artwork.filename,
        sourceUrl: artwork.sourceUrl,
        tags: artwork.tags,
        createdAt: artwork.createdAt,
        url: `/art/${encodeURIComponent(artwork.filename)}`,
      });
    } catch (error) {
      await import("node:fs/promises").then(({ unlink }) =>
        unlink(path.join(UPLOAD_DIR, savedFilename!)).catch(
          () => undefined,
        ),
      );

      request.log.error(
        error,
        "Failed to create artwork record",
      );

      return reply.code(500).send({
        error: "Database error",
      });
    }
  });

  fastify.get("/api/artworks", async (request) => {
    const userRequest = request as AuthenticatedRequest;

    const artworks = await prisma.artwork.findMany({
      where: {
        userId: userRequest.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      artworks: artworks.map((artwork) => ({
        id: artwork.id,
        filename: artwork.filename,
        sourceUrl: artwork.sourceUrl,
        tags: artwork.tags
          ? artwork.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        createdAt: artwork.createdAt,
        url: `/art/${encodeURIComponent(artwork.filename)}`,
      })),
    };
  });
};