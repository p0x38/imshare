import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";

interface TaxonomyItem { id: string; name: string; }

function TaxonomyPage() {
    const taxonomy = document.body.dataset.taxonomy === "categories" ? "categories" : "tags";
    const label = taxonomy === "categories" ? "Categories" : "Tags";
    const endpoint = `/v1/${taxonomy}`;
    const [items, setItems] = useState<TaxonomyItem[]>([]);
    const [name, setName] = useState("");
    const [error, setError] = useState("");

    async function load() {
        try {
            const response = await api<{ data?: TaxonomyItem[] }>(endpoint);
            setItems(response.data || []);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Unable to load ${taxonomy}.`);
        }
    }

    useEffect(() => { void load(); }, []);

    async function create(event: React.FormEvent) {
        event.preventDefault();
        if (!name.trim()) return;
        try {
            await api(endpoint, { method: "POST", body: JSON.stringify({ name: name.trim() }) });
            setName("");
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Unable to create ${taxonomy.slice(0, -1)}.`);
        }
    }

    async function remove(id: string) {
        if (!window.confirm(`Delete this ${taxonomy.slice(0, -1)}?`)) return;
        try {
            await api(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Unable to delete ${taxonomy.slice(0, -1)}.`);
        }
    }

    return <Page><Stack spacing={2}><Typography variant="h4" component="h1">Manage {label}</Typography>{error ? <Alert severity="error">{error}</Alert> : null}<Card variant="outlined"><CardContent><Stack component="form" onSubmit={create} direction={{ xs: "column", sm: "row" }} spacing={1}><TextField fullWidth size="small" label={`New ${taxonomy.slice(0, -1)}`} value={name} onChange={(event) => setName(event.target.value)} required /><Button type="submit" variant="contained">Create</Button></Stack></CardContent></Card><Stack spacing={1}>{items.map((item) => <Card key={item.id} variant="outlined"><CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Typography>{item.name}</Typography><Button color="error" onClick={() => void remove(item.id)}>Delete</Button></CardContent></Card>)}</Stack></Stack></Page>;
}

const root = document.querySelector("#taxonomy-page");
if (root) createRoot(root).render(<App><TaxonomyPage /></App>);
