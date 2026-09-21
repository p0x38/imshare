import { expect, test } from "vitest";
import {
    RECOMMENDATION_SCORE_MULTIPLIER,
    RECOMMENDATION_WEIGHTS,
    applyRecommendationExploration,
    jitterRecommendationScore,
    scorePersonalizedRecommendation,
    scoreTrending,
    type RecommendationPost,
} from "../src/lib/recommendation-scorer.js";

function post(overrides: Partial<RecommendationPost> = {}): RecommendationPost {
    return {
        id: "candidate",
        title: "Cats in space",
        description: "space cats",
        caption: "cute",
        contentType: "image",
        categoryId: "art",
        createdAt: new Date(),
        user: { id: "user-1", name: "Artist", handle: "artist" },
        tags: [{ tag: { id: "cats", name: "cats" } }],
        _count: { views: 100, reactions: 10, comments: 2 },
        ...overrides,
    };
}

test("recommendation weights keep recent likes above recent views", () => {
    expect(RECOMMENDATION_WEIGHTS.recentLikedPosts).toBe(2);
    expect(RECOMMENDATION_WEIGHTS.recentViewedPosts).toBe(1);
    expect(RECOMMENDATION_WEIGHTS.trending).toBe(1);
    expect(RECOMMENDATION_SCORE_MULTIPLIER).toBe(10);
});

test("trending score responds to views, likes, favorites, and comments", () => {
    const low = scoreTrending({
        views: 1,
        likes: 0,
        favorites: 0,
        comments: 0,
        createdAt: new Date(),
    });
    const high = scoreTrending({
        views: 1000,
        likes: 100,
        favorites: 50,
        comments: 25,
        createdAt: new Date(),
    });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
});

test("personalized score rewards configured interested tags and categories", () => {
    const candidate = post();
    const score = scorePersonalizedRecommendation(
        candidate,
        {
            viewedPosts: [],
            likedPosts: [],
            interestedTags: ["cats"],
            interestedCategoryIds: ["art"],
        },
        0,
    );
    expect(score.interestedTags).toBeGreaterThan(0);
    expect(score.interestedCategories).toBe(1);
    expect(score.total).toBeGreaterThan(0);
});

test("recent liked posts contribute more than the same recent viewed post", () => {
    const candidate = post();
    const source = post({
        id: "source",
        title: "Cats in space",
    });
    const viewedOnly = scorePersonalizedRecommendation(
        candidate,
        {
            viewedPosts: [source],
            likedPosts: [],
            interestedTags: [],
            interestedCategoryIds: [],
        },
        0,
    );
    const likedOnly = scorePersonalizedRecommendation(
        candidate,
        {
            viewedPosts: [],
            likedPosts: [source],
            interestedTags: [],
            interestedCategoryIds: [],
        },
        0,
    );
    expect(likedOnly.total).toBeGreaterThan(viewedOnly.total);
});

test("exploration keeps ranked order when exploration is disabled", () => {
    const items = [
        { post: post({ id: "high" }), score: 9 },
        { post: post({ id: "mid" }), score: 6 },
        { post: post({ id: "low" }), score: 2 },
    ];
    const result = applyRecommendationExploration(items, 0, () => 0.99);
    expect(result.map(({ post }) => post.id)).toEqual(["high", "mid", "low"]);
});

test("exploration can promote a lower-ranked candidate", () => {
    const items = [
        { post: post({ id: "high" }), score: 9 },
        { post: post({ id: "mid" }), score: 6 },
        { post: post({ id: "low" }), score: 2 },
    ];
    const result = applyRecommendationExploration(items, 1, () => 0.99);
    expect(result[0].post.id).not.toBe("high");
});

test("recommendation score jitter stays bounded", () => {
    expect(jitterRecommendationScore(5, 0.15, () => 1)).toBe(5.15);
    expect(jitterRecommendationScore(0, 0.15, () => 0)).toBe(0);
    expect(jitterRecommendationScore(10, 0.15, () => 1)).toBe(10);
});

test("recommendation score remains bounded by the ten-point multiplier", () => {
    const score = scorePersonalizedRecommendation(
        post(),
        {
            viewedPosts: [post({ id: "viewed" })],
            likedPosts: [post({ id: "liked" })],
            interestedTags: ["cats"],
            interestedCategoryIds: ["art"],
        },
        1,
    );
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(RECOMMENDATION_SCORE_MULTIPLIER);
});
