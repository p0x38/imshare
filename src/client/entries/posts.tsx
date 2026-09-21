import { Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
    const params = new URLSearchParams(location.search);
    const [query, setQuery] = useState(params.get("search") || "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [posts, setPosts] = useState<Post[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">(
        () => (localStorage.getItem("imshare.postGridDensity") as "compact" | "comfortable" | "spacious") || "comfortable",
    );

    function changeDensity(
        _event: React.MouseEvent<HTMLElement>,
        value: "compact" | "comfortable" | "spacious" | null,
    ) {
        if (!value) return;
        setDensity(value);
        localStorage.setItem("imshare.postGridDensity", value);
    }
    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const requestParams = new URLSearchParams({ page: String(page), limit: "48" });
            if (query.trim()) requestParams.set("q", query.trim());
            const response = await api<PostsResponse>(`/v1/search?type=posts&${requestParams}`);
            setPosts(response.data || []);
            setTotalPages(Math.max(1, response.pagination?.totalPages || 1));
            const historyParams = new URLSearchParams();
            if (query.trim()) historyParams.set("search", query.trim());
            historyParams.set("page", String(response.pagination?.page || page));
            history.replaceState(null, "", `?${historyParams}`);
            document.title = query.trim()
                ? `${t("search")}: ${query.trim()} · imshare`
                : `${t("postsPage.title")} · imshare`;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("postsPage.loadError"));
        } finally {
            setLoading(false);
        }
    }, [page, query, t]);
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
                <Typography variant="h4" component="h1">
                    {t("postsPage.title")}
                </Typography>
                <Stack
                    component="form"
                    onSubmit={submit}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                >
                    <TextField
                        fullWidth
                        size="small"
                        label={t("postsPage.searchPosts")}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <Button type="submit" variant="contained">
                        {t("postsPage.search")}
                    </Button>
                </Stack>
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                    spacing={1}
                >
                    <Typography variant="body2" color="text.secondary">
                        {t("postsPage.gridDensity")}
                    </Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={density}
                        onChange={changeDensity}
                        aria-label={t("postsPage.gridDensity")}
                    >
                        <ToggleButton value="compact">{t("postsPage.compact")}</ToggleButton>
                        <ToggleButton value="comfortable">{t("postsPage.comfortable")}</ToggleButton>
                        <ToggleButton value="spacious">{t("postsPage.spacious")}</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
                {loading ? (
                    <SkeletonGrid count={12} />
                ) : error ? (
                    <ErrorState message={error} />
                ) : (
                    <PostGrid posts={posts} density={density} />
                )}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Button
                        disabled={page <= 1}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                        {t("common.previous")}
                    </Button>
                    <Typography color="text.secondary">
                        {t("postsPage.page", { page, totalPages })}
                    </Typography>
                    <Button
                        disabled={page >= totalPages}
                        onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    >
                        {t("common.next")}
                    </Button>
                </Stack>
            </Stack>
        </Page>
    );
}
const root = document.querySelector("#posts-page");
if (root)
    createRoot(root).render(
        <App>
            <PostsPage />
        </App>,
    );
