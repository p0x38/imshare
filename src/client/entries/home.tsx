import { Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { ErrorState, SkeletonGrid } from "../components/States";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function HomePage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api<{ data?: Post[] }>("/v1/posts?limit=24")
            .then((response) => setPosts(response.data || []))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load posts."))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Page>
            <Typography variant="h4" component="h1" gutterBottom>Recent posts</Typography>
            {loading ? <SkeletonGrid count={12} /> : error ? <ErrorState message={error} /> : <PostGrid posts={posts} />}
        </Page>
    );
}

const root = document.querySelector("#home-page");
if (root) createRoot(root).render(<App><HomePage /></App>);
