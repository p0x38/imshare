import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Category { id: string; name: string }

function PostEditor() {
    const editing = location.pathname.includes("/edit/");
    const postId = editing ? decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-2)!) : null;
    const [post, setPost] = useState<Post | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [title, setTitle] = useState("");
    const [caption, setCaption] = useState("");
    const [description, setDescription] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [allowDownload, setAllowDownload] = useState(true);
    const [tags, setTags] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        void Promise.all([
            api<{ data?: Category[] }>("/v1/categories?limit=100"),
            editing && postId ? api<{ data: Post }>(`/v1/posts/${encodeURIComponent(postId)}`) : Promise.resolve(null),
        ]).then(([categoryResponse, postResponse]) => {
            setCategories(categoryResponse.data ?? []);
            if (postResponse) {
                const value = postResponse.data;
                setPost(value);
                setTitle(value.title ?? "");
                setCaption(value.caption ?? "");
                setDescription(value.description ?? "");
                setSourceUrl(value.sourceUrl ?? "");
                setAllowDownload(value.allowDownload !== false);
                setTags((value.tags ?? []).map((tag) => tag.name ?? tag.tag?.name ?? "").filter(Boolean).join(", "));
                setCategoryId(value.category?.id ?? "");
            }
        }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load post editor."));
    }, [editing, postId]);

    async function upload(file: File) {
        const data = new FormData(); data.append("file", file);
        const response = await fetch("/v1/uploads", { method: "POST", body: data });
        if (!response.ok) throw new Error(response.status === 429 ? "Upload rate limit exceeded." : "Image upload failed.");
        setProgress(0);
        return (await response.json()).data as { id: string };
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault(); setSaving(true); setError("");
        try {
            let uploadIds: string[] = [];
            if (!editing) {
                if (!files.length) throw new Error("Please choose at least one image.");
                uploadIds = [];
                for (const file of files) uploadIds.push((await upload(file)).id);
            }
            const payload = {
                title, caption: caption || null, description: description || null,
                sourceUrl: sourceUrl || null, allowDownload,
                ...(editing ? {} : { uploadIds }),
                tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
                categoryId: categoryId || null,
            };
            const response = await api<{ data: Post }>(editing ? `/v1/posts/${encodeURIComponent(postId!)}` : "/v1/posts", {
                method: editing ? "PATCH" : "POST", body: JSON.stringify(payload),
            });
            location.href = editing ? `/dashboard/posts/${encodeURIComponent(response.data.id)}/` : `/posts/${encodeURIComponent(response.data.id)}`;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save post.");
        } finally { setSaving(false); }
    }

    if (editing && !post && !error) return <Page><Typography>Loading…</Typography></Page>;
    return <Page maxWidth="md"><Stack spacing={2}><Typography variant="h4" component="h1">{editing ? "Edit Post" : "New Post"}</Typography>{error ? <Alert severity="error">{error}</Alert> : null}<Card variant="outlined"><CardContent><Stack component="form" spacing={2} onSubmit={submit}>{!editing ? <Box><Button variant="outlined" component="label">Choose images<input hidden type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></Button><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "No images selected"}</Typography></Box> : null}<TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required inputProps={{ maxLength: 200 }} /><TextField label="Image caption" value={caption} onChange={(e) => setCaption(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 10000 }} /><TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={4} /><TextField label="Source URL" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /><FormControlLabel control={<Checkbox checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />} label="Allow visitors to download the original image" /><TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} helperText="Separate tags with commas" /><FormControl fullWidth><InputLabel id="category-label">Category</InputLabel><Select labelId="category-label" label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><MenuItem value="">None</MenuItem>{categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}</Select></FormControl>{progress > 0 ? <Typography variant="body2">Uploading… {Math.round(progress)}%</Typography> : null}<Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create post"}</Button></Stack></CardContent></Card></Stack></Page>;
}

const root = document.querySelector("#post-editor-page");
if (root) createRoot(root).render(<App><PostEditor /></App>);
