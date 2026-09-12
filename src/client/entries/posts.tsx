import { Button, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import type { Post } from "../lib/types";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { ErrorState, SkeletonGrid } from "../components/States";
import { PostGrid } from "../components/PostGrid";

interface PostsResponse {
    data?: Post[];
    pagination?: { page?: number; totalPages?: number };
}

function PostsPage() {
    const params = new URLSearchParams(location.search);
    const [query, setQuery] = useState(params.get("search") || "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [posts, setPosts] = useState<Post[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const requestParams = new URLSearchParams({ page: String(page), limit: "48" });
            if (query.trim()) requestParams.set("search", query.trim());
            const response = await api<PostsResponse>(`/v1/posts?${requestParams}`);
            setPosts(response.data || []);
            setTotalPages(Math.max(1, response.pagination?.totalPages || 1));
            const historyParams = new URLSearchParams();
            if (query.trim()) historyParams.set("search", query.trim());
            historyParams.set("page", String(response.pagination?.page || page));
            history.replaceState(null, "", `?${historyParams}`);
            document.title = query.trim() ? `Search: ${query.trim()} · imshare` : "Posts · imshare";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load posts.");
        } finally {
            setLoading(false);
        }
    }, [page, query]);

    useEffect(() => {
        void load();
    }, [load]);

    function submit(event: React.FormEvent) {
        event.preventDefault();
        setPage(1);
    }

    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">Posts</Typography>
                <Stack component="form" onSubmit={submit} direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField fullWidth size="small" label="Search posts" value={query} onChange={(event) => setQuery(event.target.value)} />
                    <Button type="submit" variant="contained">Search</Button>
                </Stack>
                {loading ? <SkeletonGrid count={12} /> : error ? <ErrorState message={error} /> : <PostGrid posts={posts} />}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
                    <Typography color="text.secondary">Page {page} / {totalPages}</Typography>
                    <Button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
                </Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#posts-page");
if (root) createRoot(root).render(<App><PostsPage /></App>);
