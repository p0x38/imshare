import { Alert, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function DashboardPostPage() {
    const id = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1)!);
    const [post, setPost] = useState<Post | null>(null);
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        void api<{ data: Post }>(`/v1/posts/${encodeURIComponent(id)}`)
            .then((response) => setPost(response.data))
            .catch((cause) => {
                const status = (cause as Error & { status?: number }).status;
                if (status === 401) window.location.href = "/account/login/";
                else setError(cause instanceof Error ? cause.message : "Unable to load this post.");
            });
    }, [id]);

    async function remove() {
        if (!window.confirm("Delete this post? This cannot be undone.")) return;
        setDeleting(true); setError("");
        try {
            await api(`/v1/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
            window.location.href = "/dashboard/posts/";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to delete post.");
            setDeleting(false);
        }
    }

    if (error && !post) return <Page><Alert severity="error">{error}</Alert></Page>;
    if (!post) return <Page><LoadingState label="Loading post…" /></Page>;
    return <Page maxWidth="md"><Stack spacing={2}><Typography variant="h4" component="h1">{post.title || "Untitled"}</Typography><Typography color="text.secondary">Manage your post and its public page.</Typography>{error ? <Alert severity="error">{error}</Alert> : null}<Card variant="outlined"><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="contained" component="a" href={`/dashboard/posts/${encodeURIComponent(post.id)}/edit/`}>Edit</Button><Button variant="outlined" component="a" href={`/posts/${encodeURIComponent(post.id)}/`}>View public post</Button><Button color="error" onClick={() => void remove()} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button></Stack></CardContent></Card></Stack></Page>;
}

const root = document.querySelector("#dashboard-post-page");
if (root) createRoot(root).render(<App><DashboardPostPage /></App>);
