import { Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
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
    useEffect(() => {
        void Promise.all([
            api<{ data?: Post[] }>("/v1/recommendations?limit=24"),
            api<{ data?: Post[] }>("/v1/discovery/trending?limit=12"),
        ])
            .then(([recommended, trendingResponse]) => {
                setRecommendations(recommended.data || []);
                setTrending(trendingResponse.data || []);
            })
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : t("recommendations.error")),
            )
            .finally(() => setLoading(false));
        void api<{ data?: Post[] }>("/v1/posts?limit=24")
            .then((response) => setPosts(response.data || []))
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : t("postsPage.loadError")),
            );
    }, [t]);
    return (
        <Page>
            <Typography variant="h4" component="h1" gutterBottom>
                {t("home.recentPosts")}
            </Typography>
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
                        <PostGrid posts={recommendations.filter((post) => post.contentType !== "text")} />
                    </Stack>
                    {trending.length ? (
                        <Stack spacing={1.5}>
                            <Typography variant="h5" component="h2">
                                {t("recommendations.trending")}
                            </Typography>
                            <PostGrid posts={trending.filter((post) => post.contentType !== "text")} />
                        </Stack>
                    ) : null}
                    <Stack spacing={1.5}>
                        <Typography variant="h5" component="h2">
                            {t("home.recentPosts")}
                        </Typography>
                        <PostGrid posts={imagePosts} />
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
