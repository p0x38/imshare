import { Alert, Box, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { Post } from "../lib/types";
import { PostGrid, postGridPostLimits, usePostGridDensity, type PostGridDensity } from "./PostGrid";
import { AnimatedItem } from "./Motion";
interface PostsResponse {
    data?: Post[];
}
async function loadPosts(path: string) {
    const response = await api<PostsResponse>(path);
    return response.data || [];
}
function RecommendationSection({ title, posts, density }: { title: string; posts: Post[]; density: PostGridDensity }) {
    const visiblePosts = posts.filter((post) => post.contentType !== "text");
    if (!visiblePosts.length) return null;
    return (
        <AnimatedItem>
            <Stack spacing={1.5}>
                <Typography variant="h5" component="h2">
                    {title}
                </Typography>
                <PostGrid posts={visiblePosts} density={density} />
            </Stack>
        </AnimatedItem>
    );
}
export function RecommendationSections({ postId, density: densityProp, storageKey }: { postId: string; density?: PostGridDensity; storageKey?: string }) {
    const { t } = useTranslation();
    const [related, setRelated] = useState<Post[]>([]);
    const [recommended, setRecommended] = useState<Post[]>([]);
    const [trending, setTrending] = useState<Post[]>([]);
    const [sharedDensity, setSharedDensity] = usePostGridDensity(storageKey);
    const density = densityProp ?? sharedDensity;
    const limit = postGridPostLimits[density];
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        setError("");
        void Promise.allSettled([
            loadPosts(`/v1/posts/${encodeURIComponent(postId)}/related?limit=${limit}`),
            loadPosts(`/v1/recommendations?limit=${limit}`),
            loadPosts(`/v1/discovery/trending?limit=${limit}`),
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
    }, [postId, t, limit]);
    const visible = related.length + recommended.length + trending.length > 0;
    if (!visible && !error) return null;
    return (
        <Box sx={{ mt: { xs: 1, sm: 2 } }}>
            <Stack spacing={{ xs: 3, sm: 4 }}>
                {error ? <Alert severity="info">{error}</Alert> : null}
                <RecommendationSection title={t("recommendations.related")} posts={related} density={density} />
                <RecommendationSection
                    title={t("recommendations.recommended")}
                    posts={recommended}
                    density={density}
                />
                <RecommendationSection title={t("recommendations.trending")} posts={trending} density={density} />
            </Stack>
        </Box>
    );
}
