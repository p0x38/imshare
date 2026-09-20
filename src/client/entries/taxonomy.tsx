import { Alert, Button, Card, CardContent, Pagination, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
interface TaxonomyItem {
    id: string;
    name: string;
}
function slugify(value: string) {
    return (
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 100) || "item"
    );
}
function TaxonomyPage() {
    const { t } = useTranslation();
    const taxonomy = document.body.dataset.taxonomy === "categories" ? "categories" : "tags";
    const label = t(`taxonomy.${taxonomy}`);
    const item =
        taxonomy === "categories"
            ? t("taxonomy.categories").replace(/s$/i, "")
            : t("taxonomy.tags").replace(/s$/i, "");
    const endpoint = `/v1/${taxonomy}`;
    const [items, setItems] = useState<TaxonomyItem[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    async function load() {
        try {
            const response = await api<{ data?: TaxonomyItem[]; pagination?: { totalPages?: number } }>(`${endpoint}?page=${page}&limit=100`);
            setItems(response.data || []);
            setTotalPages(response.pagination?.totalPages ?? 1);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : t("taxonomy.loadError", { items: label.toLowerCase() }),
            );
        }
    }
    useEffect(() => {
        void load();
    }, [page]);
    async function create(event: React.FormEvent) {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;
        try {
            await api(endpoint, {
                method: "POST",
                body: JSON.stringify({ name: trimmedName, slug: slugify(trimmedName) }),
            });
            setName("");
            setPage(1);
            await load();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : t("taxonomy.createError", { item: item.toLowerCase() }),
            );
        }
    }
    async function remove(id: string) {
        if (!window.confirm(t("taxonomy.deleteConfirm", { item: item.toLowerCase() }))) return;
        try {
            await api(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
            await load();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : t("taxonomy.deleteError", { item: item.toLowerCase() }),
            );
        }
    }
    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {t("taxonomy.manage", { label })}
                </Typography>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Card variant="outlined">
                    <CardContent>
                        <Stack
                            component="form"
                            onSubmit={create}
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                        >
                            <TextField
                                fullWidth
                                size="small"
                                label={t("taxonomy.newItem", { item: item.toLowerCase() })}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                            <Button type="submit" variant="contained">
                                {t("taxonomy.create")}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <Stack spacing={1}>
                    {items.map((entry) => (
                        <Card key={entry.id} variant="outlined">
                            <CardContent
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Typography>{entry.name}</Typography>
                                <Button color="error" onClick={() => void remove(entry.id)}>
                                    {t("common.delete")}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            </Stack>
            {totalPages > 1 ? <Stack alignItems="center" sx={{ pt: 1 }}><Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} showFirstButton showLastButton /></Stack> : null}
        </Page>
    );
}
const root = document.querySelector("#taxonomy-page");
if (root)
    createRoot(root).render(
        <App>
            <TaxonomyPage />
        </App>,
    );
