export const RECOMMENDATION_SCORE_MULTIPLIER = 10;
export const RECOMMENDATION_EXPLORATION_RATE = 0.1;
export const RECOMMENDATION_SCORE_JITTER = 0.15;

export const RECOMMENDATION_WEIGHTS = {
    recentViewedPosts: 1,
    recentLikedPosts: 2,
    trending: 1,
    interestedTags: 3,
    interestedCategories: 2,
    authorAffinity: 1,
    contentType: 0.5,
    recency: 0.5,
} as const;

export interface RecommendationPost {
    id?: string;
    title: string;
    description: string | null;
    caption: string | null;
    contentType: string | null;
    categoryId: string | null;
    createdAt: Date;
    user: {
        id?: string;
        name: string | null;
        handle: string | null;
    };
    tags: Array<{ tag: { id?: string; name: string } }>;
    _count: {
        views: number;
        reactions?: number;
        comments: number;
    };
}

export interface TrendingMetrics {
    views: number;
    likes: number;
    favorites: number;
    comments: number;
    createdAt: Date;
}

export interface RecommendationProfile {
    viewedPosts: RecommendationPost[];
    likedPosts: RecommendationPost[];
    interestedTags: string[];
    interestedCategoryIds: string[];
}

export interface RecommendationScore {
    recentViewedPosts: number;
    recentLikedPosts: number;
    trending: number;
    interestedTags: number;
    interestedCategories: number;
    authorAffinity: number;
    contentType: number;
    recency: number;
    total: number;
}

export interface RecommendationRankedItem<T = RecommendationPost> {
    post: T;
    score: number;
}

export function applyRecommendationExploration<T>(
    items: RecommendationRankedItem<T>[],
    explorationRate = RECOMMENDATION_EXPLORATION_RATE,
    random: () => number = Math.random,
): RecommendationRankedItem<T>[] {
    const ranked = [...items].sort((a, b) => b.score - a.score);
    const rate = Math.min(Math.max(explorationRate, 0), 1);

    for (let index = 0; index < ranked.length - 1; index++) {
        if (random() >= rate) continue;
        const remaining = ranked.length - index - 1;
        const randomIndex = index + 1 + Math.floor(random() * remaining);
        const current = ranked[index];
        const candidate = ranked[randomIndex];
        if (!current || !candidate) continue;
        [ranked[index], ranked[randomIndex]] = [candidate, current];
    }

    return ranked;
}

export function jitterRecommendationScore(
    score: number,
    jitter = RECOMMENDATION_SCORE_JITTER,
    random: () => number = Math.random,
): number {
    if (jitter <= 0) return score;
    return Math.min(
        RECOMMENDATION_SCORE_MULTIPLIER,
        Math.max(0, score + (random() * 2 - 1) * jitter),
    );
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

function tagSet(post: RecommendationPost): Set<string> {
    return new Set(post.tags.map(({ tag }) => normalizeText(tag.name, 200)).filter(Boolean));
}

function tagSimilarity(left: RecommendationPost, right: RecommendationPost): number {
    const a = tagSet(left);
    const b = tagSet(right);
    if (!a.size && !b.size) return 1;
    if (!a.size || !b.size) return 0;

    let intersection = 0;
    for (const value of a) {
        if (b.has(value)) intersection++;
    }
    return intersection / new Set([...a, ...b]).size;
}

function authorSimilarity(left: RecommendationPost, right: RecommendationPost): number {
    if (left.user.id && right.user.id && left.user.id === right.user.id) return 1;
    if (
        left.user.handle &&
        right.user.handle &&
        normalizeText(left.user.handle, 200) === normalizeText(right.user.handle, 200)
    )
        return 1;
    if (left.user.name && right.user.name) return tokenSimilarity(left.user.name, right.user.name);
    return 0;
}

function postSimilarity(source: RecommendationPost, candidate: RecommendationPost): number {
    const tags = tagSimilarity(source, candidate);
    const category =
        source.categoryId && candidate.categoryId && source.categoryId === candidate.categoryId
            ? 1
            : 0;
    const author = authorSimilarity(source, candidate);
    const contentType =
        source.contentType && candidate.contentType && source.contentType === candidate.contentType
            ? 1
            : 0;
    const title = tokenSimilarity(source.title, candidate.title);
    const description = tokenSimilarity(source.description, candidate.description);
    const caption = tokenSimilarity(source.caption, candidate.caption);

    return (
        tags * 0.38 +
        category * 0.19 +
        author * 0.14 +
        contentType * 0.1 +
        title * 0.1 +
        description * 0.045 +
        caption * 0.045
    );
}

function sourceAffinity(candidate: RecommendationPost, sources: RecommendationPost[]): number {
    let best = 0;
    for (const [index, source] of sources.entries()) {
        const freshness = Math.exp(-index / 6);
        best = Math.max(best, postSimilarity(source, candidate) * freshness);
    }
    return best;
}

function interestedTagScore(candidate: RecommendationPost, interestedTags: string[]): number {
    if (!interestedTags.length) return 0;
    const interests = new Set(interestedTags.map((tag) => normalizeText(tag, 200)).filter(Boolean));
    if (!interests.size) return 0;

    const candidateTags = tagSet(candidate);
    let matches = 0;
    for (const tag of candidateTags) {
        if (interests.has(tag)) matches++;
    }
    return matches ? Math.min(matches / Math.max(interests.size, candidateTags.size), 1) : 0;
}

function interestedCategoryScore(candidate: RecommendationPost, categoryIds: string[]): number {
    if (!candidate.categoryId || !categoryIds.length) return 0;
    return categoryIds.includes(candidate.categoryId) ? 1 : 0;
}

function authorAffinityScore(candidate: RecommendationPost, sources: RecommendationPost[]): number {
    if (!sources.length) return 0;
    return Math.max(...sources.map((source) => authorSimilarity(source, candidate)));
}

function contentTypeAffinityScore(
    candidate: RecommendationPost,
    sources: RecommendationPost[],
): number {
    if (!candidate.contentType || !sources.length) return 0;
    return Math.max(
        ...sources.map((source) => (source.contentType === candidate.contentType ? 1 : 0)),
    );
}

function recencyScore(createdAt: Date): number {
    const ageDays = Math.max((Date.now() - createdAt.getTime()) / 86_400_000, 0);
    return Math.exp(-ageDays / 45);
}

export function scoreTrending(metrics: TrendingMetrics): number {
    const views = Math.log1p(Math.max(metrics.views, 0));
    const likes = Math.log1p(Math.max(metrics.likes, 0));
    const favorites = Math.log1p(Math.max(metrics.favorites, 0));
    const comments = Math.log1p(Math.max(metrics.comments, 0));
    const engaged = views * 0.3 + likes * 1.15 + favorites * 1.5 + comments * 0.8;
    const engagement = Math.min(engaged / 14, 1);
    return engagement * 0.8 + recencyScore(metrics.createdAt) * 0.2;
}

export function scorePersonalizedRecommendation(
    candidate: RecommendationPost,
    profile: RecommendationProfile,
    trending: number,
): RecommendationScore {
    const recentViewedPosts = sourceAffinity(candidate, profile.viewedPosts);
    const recentLikedPosts = sourceAffinity(candidate, profile.likedPosts);
    const interestedTags = interestedTagScore(candidate, profile.interestedTags);
    const interestedCategories = interestedCategoryScore(candidate, profile.interestedCategoryIds);
    const authorAffinity = authorAffinityScore(candidate, [
        ...profile.likedPosts,
        ...profile.viewedPosts,
    ]);
    const contentType = contentTypeAffinityScore(candidate, [
        ...profile.likedPosts,
        ...profile.viewedPosts,
    ]);
    const recency = recencyScore(candidate.createdAt);

    const weighted = [
        [recentViewedPosts, RECOMMENDATION_WEIGHTS.recentViewedPosts],
        [recentLikedPosts, RECOMMENDATION_WEIGHTS.recentLikedPosts],
        [trending, RECOMMENDATION_WEIGHTS.trending],
        [interestedTags, RECOMMENDATION_WEIGHTS.interestedTags],
        [interestedCategories, RECOMMENDATION_WEIGHTS.interestedCategories],
        [authorAffinity, RECOMMENDATION_WEIGHTS.authorAffinity],
        [contentType, RECOMMENDATION_WEIGHTS.contentType],
        [recency, RECOMMENDATION_WEIGHTS.recency],
    ] as const;

    const totalWeight = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    const total =
        totalWeight === 0
            ? 0
            : (weighted.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight) *
              RECOMMENDATION_SCORE_MULTIPLIER;

    return {
        recentViewedPosts,
        recentLikedPosts,
        trending,
        interestedTags,
        interestedCategories,
        authorAffinity,
        contentType,
        recency,
        total,
    };
}

// Kept for related-post ranking.
export interface RelatedPostScore {
    tags: number;
    category: number;
    contentType: number;
    author: number;
    title: number;
    description: number;
    caption: number;
    recency: number;
    engagement: number;
    total: number;
}

export function scoreRecommendation(
    source: RecommendationPost,
    candidate: RecommendationPost,
): RelatedPostScore {
    const tags = tagSimilarity(source, candidate);
    const category = source.categoryId && source.categoryId === candidate.categoryId ? 1 : 0;
    const contentType = (source.contentType ?? "") === (candidate.contentType ?? "") ? 1 : 0;
    const author = authorSimilarity(source, candidate);
    const title = tokenSimilarity(source.title, candidate.title);
    const description = tokenSimilarity(source.description, candidate.description);
    const caption = tokenSimilarity(source.caption, candidate.caption);
    const recency = recencyScore(candidate.createdAt);
    const engagement = Math.min(
        (Math.log1p(candidate._count.views) * 0.45 +
            Math.log1p(candidate._count.reactions ?? 0) * 1.5 +
            Math.log1p(candidate._count.comments) * 1.25) /
            12,
        1,
    );

    const total =
        title * 18 +
        tags * 20 +
        category * 12 +
        author * 8 +
        description * 7 +
        caption * 7 +
        contentType * 2 +
        recency * 3 +
        engagement * 2;

    return {
        tags,
        category,
        contentType,
        author,
        title,
        description,
        caption,
        recency,
        engagement,
        total,
    };
}

export interface RecommendationDiversityOptions {
    maxPerAuthor?: number;
    maxPerCategory?: number;
    duplicateThreshold?: number;
}

function recommendationText(post: RecommendationPost): string {
    return [post.title, post.caption, post.description].filter(Boolean).join(" ");
}

/**
 * Reorders a ranked candidate list so its first page is less repetitive.
 * Author/category overflow is deferred rather than discarded, while near-
 * duplicate content is removed from the result set.
 */
export function applyRecommendationDiversity(
    items: RecommendationRankedItem<RecommendationPost>[],
    options: RecommendationDiversityOptions = {},
): RecommendationRankedItem<RecommendationPost>[] {
    const maxPerAuthor = Math.max(1, Math.floor(options.maxPerAuthor ?? 2));
    const maxPerCategory = Math.max(1, Math.floor(options.maxPerCategory ?? 3));
    const duplicateThreshold = Math.min(Math.max(options.duplicateThreshold ?? 0.94, 0), 1);
    const ordered = items;
    const preferred: RecommendationRankedItem<RecommendationPost>[] = [];
    const deferred: RecommendationRankedItem<RecommendationPost>[] = [];
    const considered: RecommendationRankedItem<RecommendationPost>[] = [];
    const authorCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    for (const item of ordered) {
        const text = recommendationText(item.post);
        const textTokens = tokens(text);
        const isDuplicate =
            textTokens.size > 0 &&
            considered.some((existing) => {
                const existingText = recommendationText(existing.post);
                return (
                    tokens(existingText).size > 0 &&
                    tokenSimilarity(existingText, text) >= duplicateThreshold
                );
            });
        if (isDuplicate) continue;

        considered.push(item);

        const authorKey =
            item.post.user.id ??
            normalizeText(item.post.user.handle ?? item.post.user.name, 200);
        const categoryKey = item.post.categoryId ?? "";
        const authorOverflow =
            Boolean(authorKey) && (authorCounts.get(authorKey) ?? 0) >= maxPerAuthor;
        const categoryOverflow =
            Boolean(categoryKey) && (categoryCounts.get(categoryKey) ?? 0) >= maxPerCategory;

        if (authorOverflow || categoryOverflow) {
            deferred.push(item);
            continue;
        }

        preferred.push(item);
        if (authorKey) authorCounts.set(authorKey, (authorCounts.get(authorKey) ?? 0) + 1);
        if (categoryKey)
            categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) ?? 0) + 1);
    }

    return [...preferred, ...deferred];
}
