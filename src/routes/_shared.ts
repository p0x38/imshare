import { randomUUID } from "node:crypto";

import { prisma } from "../lib/auth.js";

export const postInclude = {
  user: { select: { id: true, name: true, image: true } },
  category: true,
  tags: { include: { tag: true } },
  uploads: true,
} as const;

export function postView(post: any) {
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
      id: x.id,
      filename: x.filename,
      originalName: x.originalName,
      mimeType: x.mimeType,
      size: x.size,
      createdAt: x.createdAt,
      url: `/v1/posts/image/${encodeURIComponent(x.id)}`,
    })),
  };
}

export async function findTags(names: string[]) {
  const unique = [...new Set(names.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const result = [];

  for (const name of unique) {
    const slug = name.replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || name;
    result.push(
      await prisma.tag.upsert({
        where: { slug },
        update: { name },
        create: {
          name,
          slug: slug || `tag-${randomUUID().slice(0, 8)}`,
        },
      }),
    );
  }

  return result;
}
