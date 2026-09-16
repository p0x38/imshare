import { Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { ErrorState, SkeletonGrid } from "../components/States";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function HomePage() {
    const { t } = useTranslation();
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        void api<{ data?: Post[] }>("/v1/posts?limit=24")
            .then((response) => setPosts(response.data || []))
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : t("postsPage.loadError")),
            )
            .finally(() => setLoading(false));
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
                <PostGrid posts={posts} />
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
