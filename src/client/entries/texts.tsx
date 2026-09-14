import { Button, Card, CardActionArea, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { ErrorState, SkeletonGrid } from "../components/States";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface TextsResponse { data?: Post[]; pagination?: { page?: number; totalPages?: number } }
function TextsPage() {
    const { t } = useTranslation();
    const params = new URLSearchParams(location.search);
    const [query, setQuery] = useState(params.get("search") || "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [texts, setTexts] = useState<Post[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const requestParams = new URLSearchParams({ page: String(page), limit: "24" });
            if (query.trim()) requestParams.set("search", query.trim());
            const response = await api<TextsResponse>(`/v1/texts?${requestParams}`);
            setTexts(response.data || []); setTotalPages(Math.max(1, response.pagination?.totalPages || 1));
        } catch (cause) { setError(cause instanceof Error ? cause.message : t("textsPage.loadError")); }
        finally { setLoading(false); }
    }, [page, query, t]);
    useEffect(() => { void load(); }, [load]);
    return <Page><Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h4" component="h1">{t("textsPage.title")}</Typography><Button component="a" href="/texts/new/" variant="contained">{t("textsPage.newText")}</Button></Stack><Stack component="form" onSubmit={(event) => { event.preventDefault(); setPage(1); }} direction={{ xs: "column", sm: "row" }} spacing={1}><TextField fullWidth size="small" label={t("textsPage.searchTexts")} value={query} onChange={(event) => setQuery(event.target.value)} /><Button type="submit" variant="contained">{t("postsPage.search")}</Button></Stack>{loading ? <SkeletonGrid count={8} /> : error ? <ErrorState message={error} /> : texts.length ? <Stack spacing={1.5}>{texts.map((text) => <Card key={text.id} variant="outlined"><CardActionArea component="a" href={`/texts/${encodeURIComponent(text.id)}/`}><CardContent><Typography variant="h6" gutterBottom>{text.title}</Typography><Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text.textContent}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{text.author?.name || text.authorName}</Typography></CardContent></CardActionArea></Card>)}</Stack> : <Typography color="text.secondary">{t("textsPage.empty")}</Typography>}<Stack direction="row" justifyContent="space-between"><Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t("common.previous")}</Button><Typography color="text.secondary">{t("postsPage.page", { page, totalPages })}</Typography><Button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t("common.next")}</Button></Stack></Stack></Page>;
}
const root = document.querySelector("#texts-page"); if (root) createRoot(root).render(<App><TextsPage /></App>);
