export interface RecommendationPost {
    title: string;
    description: string | null;
    caption: string | null;
    contentType: string | null;
    categoryId: string | null;
    createdAt: Date;
    user: {
        name: string | null;
        handle: string | null;
    };
    tags: Array<{ tag: { name: string } }>;
    _count: {
        views: number;
        reactions: number;
        comments: number;
    };
}

export interface RecommendationScore {
    titleEdit: number;
    titleTokens: number;
    descriptionEdit: number;
    descriptionTokens: number;
    captionSimilarity: number;
    tags: number;
    category: number;
    authorExact: number;
    authorEdit: number;
    contentType: number;
    titleLengthSimilarity: number;
    recency: number;
    engagement: number;
    total: number;
}

function normalizeText(value: string | null | undefined, maxLength = 1200): string {
    return (value ?? "")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .slice(0, maxLength);
}

function tokens(value: string | null | undefined): Set<string> {
    return new Set(
        normalizeText(value)
            .split(/\s+/)
            .filter((token) => token.length >= 2),
    );
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (a.length > b.length) [a, b] = [b, a];

    let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        const current = new Array<number>(a.length + 1);
        current[0] = j;
        for (let i = 1; i <= a.length; i++) {
            const insertion = current[i - 1]! + 1;
            const deletion = previous[i]! + 1;
            const substitution = previous[i - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[i] = Math.min(insertion, deletion, substitution);
        }
        previous = current;
    }

    return previous[a.length]!;
}

function stringSimilarity(a: string | null | undefined, b: string | null | undefined): number {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (!left && !right) return 1;
    if (!left || !right) return 0;
    const longest = Math.max(left.length, right.length);
    return 1 - levenshtein(left, right) / longest;
}

function tokenSimilarity(a: string | null | undefined, b: string | null | undefined): number {
    const left = tokens(a);
    const right = tokens(b);
    if (!left.size && !right.size) return 1;
    if (!left.size || !right.size) return 0;

    let intersection = 0;
    for (const token of left) {
        if (right.has(token)) intersection++;
    }

    return intersection / new Set([...left, ...right]).size;
}

function tagSimilarity(
    left: Array<{ tag: { name: string } }>,
    right: Array<{ tag: { name: string } }>,
): number {
    const a = new Set(left.map(({ tag }) => normalizeText(tag.name, 200)).filter(Boolean));
    const b = new Set(right.map(({ tag }) => normalizeText(tag.name, 200)).filter(Boolean));
    if (!a.size && !b.size) return 1;
    if (!a.size || !b.size) return 0;

    let intersection = 0;
    for (const value of a) {
        if (b.has(value)) intersection++;
    }

    return intersection / new Set([...a, ...b]).size;
}

function recencyScore(createdAt: Date): number {
    const ageDays = Math.max((Date.now() - createdAt.getTime()) / 86_400_000, 0);
    return Math.exp(-ageDays / 45);
}

function engagementScore(post: RecommendationPost): number {
    const views = Math.log1p(post._count.views);
    const reactions = Math.log1p(post._count.reactions);
    const comments = Math.log1p(post._count.comments);
    return Math.min((views * 0.45 + reactions * 1.5 + comments * 1.25) / 12, 1);
}

export function scoreRecommendation(
    source: RecommendationPost,
    candidate: RecommendationPost,
): RecommendationScore {
    const titleEdit = stringSimilarity(source.title, candidate.title);
    const titleTokens = tokenSimilarity(source.title, candidate.title);
    const descriptionEdit = stringSimilarity(source.description, candidate.description);
    const descriptionTokens = tokenSimilarity(source.description, candidate.description);
    const captionSimilarity = tokenSimilarity(source.caption, candidate.caption);

    const authorValue = [source.user.name, source.user.handle].filter(Boolean).join(" ");
    const candidateAuthorValue = [candidate.user.name, candidate.user.handle]
        .filter(Boolean)
        .join(" ");
    const authorEdit = stringSimilarity(authorValue, candidateAuthorValue);
    const authorExact =
        source.user.handle && candidate.user.handle
            ? normalizeText(source.user.handle, 200) === normalizeText(candidate.user.handle, 200)
                ? 1
                : 0
            : normalizeText(source.user.name, 200) === normalizeText(candidate.user.name, 200)
              ? 1
              : 0;

    const tags = tagSimilarity(source.tags, candidate.tags);
    const category = source.categoryId && source.categoryId === candidate.categoryId ? 1 : 0;
    const contentType = (source.contentType ?? "") === (candidate.contentType ?? "") ? 1 : 0;
    const recency = recencyScore(candidate.createdAt);
    const engagement = engagementScore(candidate);
    const titleLengthSimilarity =
        1 -
        Math.min(
            Math.abs(source.title.length - candidate.title.length) /
                Math.max(source.title.length, candidate.title.length, 1),
            1,
        );

    const total =
        titleEdit * 18 +
        titleTokens * 12 +
        descriptionEdit * 7 +
        descriptionTokens * 7 +
        captionSimilarity * 3 +
        tags * 20 +
        category * 12 +
        authorExact * 8 +
        authorEdit * 4 +
        contentType * 2 +
        titleLengthSimilarity * 2 +
        recency * 3 +
        engagement * 2;

    return {
        titleEdit,
        titleTokens,
        descriptionEdit,
        descriptionTokens,
        captionSimilarity,
        tags,
        category,
        authorExact,
        authorEdit,
        contentType,
        titleLengthSimilarity,
        recency,
        engagement,
        total,
    };
}
