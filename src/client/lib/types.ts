export interface Upload {
    id: string;
    url: string;
    alt?: string | null;
    createdAt?: string;
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
    author?: Author | null;
    authorName?: string | null;
    viewCount?: number;
    uploads?: Upload[];
    tags?: Array<{ id?: string; name?: string; tag?: { id: string; name: string } }>;
    categories?: Array<{ id?: string; name?: string; category?: { id: string; name: string } }>;
    createdAt?: string;
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
