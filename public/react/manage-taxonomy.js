import { useEffect, useState } from "https://esm.sh/react@19.1.1?target=es2022";
import {
    Button,
    Card,
    CardContent,
    Stack,
    TextField,
    Typography,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import { api, h, LoadingState, mount, notify, Page } from "/react/core.js";

function TaxonomyPage({ type }) {
    const [items, setItems] = useState(null);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const endpoint = type === "tags" ? "/v1/tags" : "/v1/categories";
    const label = type === "tags" ? "tag" : "category";

    const load = async () => {
        const response = await api(`${endpoint}?limit=100`);
        setItems(response.data || []);
    };

    useEffect(() => {
        load().catch((cause) => notify(cause instanceof Error ? cause.message : `Unable to load ${label}s.`, "error"));
    }, [type]);

    const create = async (event) => {
        event.preventDefault();
        try {
            await api(endpoint, {
                method: "POST",
                body: JSON.stringify({ name, slug, ...(type === "categories" ? { description: description || undefined } : {}) }),
            });
            setName("");
            setSlug("");
            setDescription("");
            await load();
            notify(`${label.charAt(0).toUpperCase() + label.slice(1)} created.`, "success");
        } catch (cause) {
            notify(cause instanceof Error ? cause.message : `Unable to create ${label}.`, "error");
        }
    };

    const remove = async (id) => {
        if (!window.confirm(`Delete this ${label}?`)) return;
        try {
            await api(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
            await load();
            notify(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted.`, "success");
        } catch (cause) {
            notify(cause instanceof Error ? cause.message : `Unable to delete ${label}.`, "error");
        }
    };

    return h(
        Page,
        null,
        h(
            Stack,
            { spacing: 2 },
            h(Typography, { variant: "h4", component: "h1" }, `Manage ${label}s`),
            h(Card, { variant: "outlined", component: "form", onSubmit: create },
                h(CardContent, null,
                    h(Stack, { spacing: 2 },
                        h(TextField, { label: "Name", value: name, onChange: (event) => setName(event.target.value), inputProps: { maxLength: 100 }, required: true }),
                        h(TextField, { label: "Slug", value: slug, onChange: (event) => setSlug(event.target.value), inputProps: { maxLength: 100, pattern: "[a-z0-9-]+" }, required: true }),
                        type === "categories" ? h(TextField, { label: "Description", value: description, onChange: (event) => setDescription(event.target.value), inputProps: { maxLength: 2000 }, multiline: true, minRows: 3 }) : null,
                        h(Button, { type: "submit", variant: "contained", sx: { alignSelf: "flex-start" } }, `Create ${label}`),
                    ),
                ),
            ),
            items === null ? h(LoadingState) : h(Stack, { spacing: 1 }, h(Typography, { color: "text.secondary" }, `${items.length} ${label}${items.length === 1 ? "" : "s"}`), ...items.map((item) => h(Card, { key: item.id, variant: "outlined" }, h(CardContent, null, h(Stack, { direction: "row", spacing: 2, justifyContent: "space-between", alignItems: "center" }, h(Stack, null, h(Typography, { variant: "h6" }, item.name), h(Typography, { color: "text.secondary" }, `${item.slug} · ${item._count?.posts ?? 0} post(s)`), item.description ? h(Typography, null, item.description) : null), h(Button, { color: "error", onClick: () => remove(item.id) }, "Delete"))))),
        ),
    );
}

const root = document.querySelector("#taxonomy-page");
const type = document.body.dataset.taxonomy || "tags";
if (root) mount(root, h(TaxonomyPage, { type }));
