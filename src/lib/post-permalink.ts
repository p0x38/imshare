import type { Post, User } from "@prisma/client";

export const PERMALINK_PATTERNS = ["user", "posts"] as const;
export const PERMALINK_ID_TYPES = ["normalizedTitle", "internalId", "creationDate", "custom"] as const;

export type PermalinkPattern = (typeof PERMALINK_PATTERNS)[number];
export type PermalinkIdType = (typeof PERMALINK_ID_TYPES)[number];

export function normalizePostTitle(title: string) {
    return title
        .normalize("NFKC")
        .toLowerCase()
        .trim()
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || "post";
}

function dateKey(value: Date) {
    return value.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export function permalinkBase(post: Pick<Post, "id" | "title" | "createdAt" | "customPostId">, idType: PermalinkIdType) {
    switch (idType) {
        case "normalizedTitle":
            return normalizePostTitle(post.title);
        case "creationDate":
            return dateKey(post.createdAt);
        case "custom":
            return normalizePostTitle(post.customPostId?.trim() || post.title);
        case "internalId":
        default:
            return post.id;
    }
}

export function postPermalink(post: Pick<Post, "id" | "title" | "createdAt" | "customPostId" | "permalinkPattern" | "permalinkIdType" | "permalinkKey">, user?: Pick<User, "handle" | "id"> | null) {
    const key = post.permalinkKey || permalinkBase(post, post.permalinkIdType as PermalinkIdType);
    if (post.permalinkPattern === "posts") return `/posts/${encodeURIComponent(key)}/`;
    const handle = user?.handle || user?.id || "user";
    return `/${encodeURIComponent(handle)}/${encodeURIComponent(key)}/`;
}
