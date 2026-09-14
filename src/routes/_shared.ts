import { randomUUID } from "node:crypto";
import { prisma } from "../lib/auth.js";
import { postPermalink } from "../lib/post-permalink.js";
export { ok } from "../lib/api.js";

export const postInclude = {
    user: { select: { id: true, name: true, handle: true, image: true, updatedAt: true } },
    category: true,
    tags: { include: { tag: true } },
    uploads: true,
    reactions: { select: { type: true } },
    _count: { select: { views: true } },
} as const;

export function postView(post: any) {
    const reactionCounts = Object.fromEntries(["like", "favorite", "save"].map((type) => [type, post.reactions?.filter((reaction: any) => reaction.type === type).length ?? 0]));
    return {
        id: post.id,
        title: post.title,
        contentType: post.contentType ?? (post.uploads?.length ? "image" : "text"),
        textContent: post.textContent ?? null,
        description: post.description,
        caption: post.caption,
        sourceUrl: post.sourceUrl,
        originalCreator: post.originalCreator,
        originalCreatedAt: post.originalCreatedAt,
        allowDownload: post.allowDownload,
        status: post.status,
        visibility: post.visibility,
        publishedAt: post.publishedAt,
        scheduledAt: post.scheduledAt,
        hiddenAt: post.hiddenAt,
        contentWarning: post.contentWarning,
        permalinkPattern: post.permalinkPattern,
        permalinkIdType: post.permalinkIdType,
        customPostId: post.customPostId,
        permalinkKey: post.permalinkKey,
        permalink: postPermalink(post, post.user),
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: {
            ...post.user,
            avatarUrl: `/v1/users/${encodeURIComponent(post.user.id)}/avatar?v=${encodeURIComponent(post.user.updatedAt.toISOString())}`,
        },
        authorName: post.user.name || post.user.id,
        viewCount: post._count?.views ?? 0,
        category: post.category,
        tags: post.tags.map((x: any) => x.tag),
        uploads: post.uploads.map((x: any) => ({ id: x.id, filename: x.filename, originalName: x.originalName, mimeType: x.mimeType, size: x.size, createdAt: x.createdAt, thumbhash: x.thumbhash, url: `/v1/posts/image/${encodeURIComponent(x.id)}` })),
        reactions: reactionCounts,
    };
}

export async function findTags(names: string[]) {
    const unique = [...new Set(names.map((x) => x.trim().toLowerCase()).filter(Boolean))];
    const result = [];
    for (const name of unique) {
        const slug = name.replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || name;
        result.push(await prisma.tag.upsert({ where: { slug }, update: { name }, create: { name, slug: slug || `tag-${randomUUID().slice(0, 8)}` } }));
    }
    return result;
}
