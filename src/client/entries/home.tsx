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

function HomePage() {
    const { t } = useTranslation();
    const [posts, setPosts] = useState<Post[]>([]);
    const [recommendations, setRecommendations] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const imagePosts = posts.filter((post) => post.contentType !== "text");
    const texts = posts.filter((post) => post.contentType === "text");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [density, setDensity] = usePostGridDensity();
    const limit = postGridPostLimits[density];
    useEffect(() => {
        void Promise.all([
            api<{ data?: Post[] }>(`/v1/recommendations?limit=${limit}`),
            api<{ data?: Post[] }>(`/v1/discovery/trending?limit=${limit}`),
        ])
            .then(([recommended, trendingResponse]) => {
                setRecommendations(recommended.data || []);
                setTrending(trendingResponse.data || []);
            })
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : t("recommendations.error")),
            )
            .finally(() => setLoading(false));
        void api<{ data?: Post[] }>(`/v1/posts?limit=${limit}`)
            .then((response) => setPosts(response.data || []))
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : t("postsPage.loadError")),
            );
    }, [t]);
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
            ) : error ? (
                <ErrorState message={error} />
            ) : (
                <Stack spacing={{ xs: 3, sm: 4 }}>
                    <Stack spacing={1.5}>
                        <Typography variant="h5" component="h2">
                            {t("recommendations.recommended")}
                        </Typography>
                        <PostGrid posts={recommendations.filter((post) => post.contentType !== "text").slice(0, limit)} density={density} />
                    </Stack>
                    {trending.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                {t("recommendations.trending")}
                            </Typography>
                            <PostGrid posts={trending.filter((post) => post.contentType !== "text").slice(0, limit)} density={density} />
                        </Stack>
                    ) : null}
                    <Stack spacing={1.5}>
                        <Typography variant="h5" component="h2">
                            {t("home.recentPosts")}
                        </Typography>
                        <PostGrid posts={imagePosts.slice(0, limit)} density={density} />
                    </Stack>
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
        </App>,
    );
