import { Alert, Box, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { Post } from "../lib/types";
import { PostGrid } from "./PostGrid";
import { AnimatedItem } from "./Motion";
interface PostsResponse {
    data?: Post[];
}
async function loadPosts(path: string) {
    const response = await api<PostsResponse>(path);
    return response.data || [];
}
function RecommendationSection({ title, posts }: { title: string; posts: Post[] }) {
    const visiblePosts = posts.filter((post) => post.contentType !== "text");
    if (!visiblePosts.length) return null;
    return (
        <AnimatedItem>
            <Stack spacing={1.5}>
                <Typography variant="h5" component="h2">
                    {title}
                </Typography>
                <PostGrid posts={visiblePosts} />
            </Stack>
        </AnimatedItem>
    );
}
export function RecommendationSections({ postId }: { postId: string }) {
    const { t } = useTranslation();
    const [related, setRelated] = useState<Post[]>([]);
    const [recommended, setRecommended] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        setError("");
        void Promise.allSettled([
            loadPosts(`/v1/posts/${encodeURIComponent(postId)}/related?limit=8`),
            loadPosts("/v1/recommendations?limit=8"),
            loadPosts("/v1/discovery/trending?limit=8"),
        ]).then((results) => {
            if (!active) return;
            const [relatedResult, recommendedResult, trendingResult] = results;
            let failed = false;
            if (relatedResult.status === "fulfilled") setRelated(relatedResult.value);
            else failed = true;
            if (recommendedResult.status === "fulfilled") setRecommended(recommendedResult.value);
            else failed = true;
            if (trendingResult.status === "fulfilled") setTrending(trendingResult.value);
            else failed = true;
            if (failed) setError(t("recommendations.error"));
        });
        return () => {
            active = false;
        };
    }, [postId, t]);
    const visible = related.length + recommended.length + trending.length > 0;
    if (!visible && !error) return null;
    return (
        <Box sx={{ mt: { xs: 1, sm: 2 } }}>
            <Stack spacing={{ xs: 3, sm: 4 }}>
                {error ? <Alert severity="info">{error}</Alert> : null}
                <RecommendationSection title={t("recommendations.related")} posts={related} />
                <RecommendationSection
                    title={t("recommendations.recommended")}
                    posts={recommended}
                />
                <RecommendationSection title={t("recommendations.trending")} posts={trending} />
            </Stack>
        </Box>
    );
}
