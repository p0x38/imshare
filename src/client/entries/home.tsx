import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid, postGridPostLimits, usePostGridDensity } from "../components/PostGrid";
import { TextList } from "../components/TextList";
import { ErrorState, SkeletonGrid } from "../components/States";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function imagePostsOnly(posts: Post[]) {
    return posts.filter((post) => post.contentType !== "text");
}

function takeUniquePosts(posts: Post[], usedIds: Set<string>, limit: number) {
    const result: Post[] = [];
    for (const post of imagePostsOnly(posts)) {
        if (usedIds.has(post.id)) continue;
        usedIds.add(post.id);
        result.push(post);
        if (result.length >= limit) break;
    }
    return result;
}

interface PostResponse {
    data?: Post[];
}

function HomePage() {
    const { t } = useTranslation();
    const [posts, setPosts] = useState<Post[]>([]);
    const [recommendations, setRecommendations] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<Post[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [density, setDensity] = usePostGridDensity();
    const limit = postGridPostLimits[density];
    const requestLimit = Math.min(limit * 2, 100);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        void Promise.allSettled([
            api<PostResponse>(`/v1/recommendations?limit=${requestLimit}`),
            api<PostResponse>(`/v1/discovery/trending?limit=${requestLimit}`),
            api<PostResponse>(`/v1/discovery/recently-viewed?limit=${requestLimit}`),
            api<PostResponse>(`/v1/posts?limit=${requestLimit}`),
        ]).then((results) => {
            if (!active) return;
            const [recommendedResult, trendingResult, viewedResult, recentResult] = results;
            let failed = false;

            if (recommendedResult.status === "fulfilled") {
                setRecommendations(recommendedResult.value.data ?? []);
            } else {
                failed = true;
            }

            if (trendingResult.status === "fulfilled") {
                setTrending(trendingResult.value.data ?? []);
            } else {
                failed = true;
            }

            if (viewedResult.status === "fulfilled") {
                setRecentlyViewed(viewedResult.value.data ?? []);
            }

            if (recentResult.status === "fulfilled") {
                setPosts(recentResult.value.data ?? []);
            } else {
                failed = true;
            }

            if (failed) setError(t("recommendations.error"));
            setLoading(false);
        });

        return () => {
            active = false;
        };
    }, [t, requestLimit]);

    const usedIds = new Set<string>();
    const recommendedPosts = takeUniquePosts(recommendations, usedIds, limit);
    const trendingPosts = takeUniquePosts(trending, usedIds, limit);
    const recentlyViewedPosts = takeUniquePosts(recentlyViewed, usedIds, limit);
    const recentPosts = takeUniquePosts(posts, usedIds, limit);
    const texts = posts.filter((post) => post.contentType === "text");

    return (
        <Page maxWidth="full">
            <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                spacing={1.5}
                sx={{ mb: 2 }}
            >
                <Typography variant="h4" component="h1">
                    {t("home.recentPosts")}
                </Typography>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={density}
                    onChange={(_, value) => {
                        if (value) setDensity(value);
                    }}
                    aria-label={t("postsPage.gridDensity")}
                >
                    <ToggleButton value="spacious">{t("postsPage.threeByThree")}</ToggleButton>
                    <ToggleButton value="comfortable">{t("postsPage.fourByFour")}</ToggleButton>
                    <ToggleButton value="compact">{t("postsPage.sixBySix")}</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {loading ? (
                <SkeletonGrid count={12} />
            ) : (
                <Stack spacing={{ xs: 3, sm: 4 }}>
                    {error ? <ErrorState message={error} /> : null}

                    {recommendedPosts.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                {t("recommendations.recommended")}
                            </Typography>
                            <PostGrid posts={recommendedPosts} density={density} />
                        </Stack>
                    ) : null}

                    {trendingPosts.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                {t("recommendations.trending")}
                            </Typography>
                            <PostGrid posts={trendingPosts} density={density} />
                        </Stack>
                    ) : null}

                    {recentlyViewedPosts.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                {t("recommendations.recentlyViewed")}
                            </Typography>
                            <PostGrid posts={recentlyViewedPosts} density={density} />
                        </Stack>
                    ) : null}

                    {recentPosts.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                {t("home.recentPosts")}
                            </Typography>
                            <PostGrid posts={recentPosts} density={density} />
                        </Stack>
                    ) : null}

                    {texts.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                Texts
                            </Typography>
                            <TextList texts={texts} />
                        </Stack>
                    ) : null}
                </Stack>
            )}
        </Page>
    );
}

const root = document.querySelector("#home-page");
if (root)
    createRoot(root).render(
        <App>
            <HomePage />
        </App>
    );
