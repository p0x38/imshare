import { useEffect, useState } from "https://esm.sh/react@19.1.1?target=es2022";
import { Alert, Button, Stack, Typography } from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import { api, h, mount, Page, PostGrid, SkeletonGrid } from "/react/core.js";

function HomePage() {
    const [posts, setPosts] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/v1/posts?limit=24")
            .then((response) => setPosts(response.data || []))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load posts."));
    }, []);

    return h(
        Page,
        null,
        h(
            Stack,
            { spacing: 2 },
            h(Typography, { variant: "h4", component: "h1" }, "Recent artwork"),
            h(Typography, null, "A self-hosted image archive."),
            h(Button, { variant: "contained", component: "a", href: "/dashboard/posts/new/", sx: { alignSelf: "flex-start" } }, "New post"),
            error ? h(Alert, { severity: "error" }, error) : posts === null ? h(SkeletonGrid, { count: 8 }) : h(PostGrid, { posts, empty: posts.length === 0 }),
        ),
    );
}

const root = document.querySelector("#home-page");
if (root) mount(root, h(HomePage));
