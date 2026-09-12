export interface Upload {
    id: string;
    url: string;
    alt?: string | null;
    filename?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    createdAt?: string;
    thumbhash?: string | null;
}

export interface Author {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
}

export interface Post {
    id: string;
    title?: string | null;
    description?: string | null;
    caption?: string | null;
    sourceUrl?: string | null;
    allowDownload?: boolean;
    status?: string;
    visibility?: string;
    publishedAt?: string | null;
    scheduledAt?: string | null;
    hiddenAt?: string | null;
    contentWarning?: string | null;
    author?: Author | null;
    authorName?: string | null;
    viewCount?: number;
    uploads?: Upload[];
    category?: { id: string; name: string } | null;
    tags?: Array<{ id?: string; name?: string; tag?: { id: string; name: string } }>;
    categories?: Array<{ id?: string; name?: string; category?: { id: string; name: string } }>;
    reactions?: { like?: number; favorite?: number; save?: number };
    createdAt?: string;
    updatedAt?: string;
}

export interface User extends Author {
    email?: string | null;
    bio?: string | null;
    avatarMode?: string | null;
    avatarValue?: string | null;
    websiteUrl?: string | null;
    githubUrl?: string | null;
    profileLinks?: Array<{ id: string; label: string; url: string }>;
}
