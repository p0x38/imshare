import {
    Alert, Box, Button, Card, CardContent, Checkbox, FormControl, FormControlLabel, IconButton, InputLabel,
    LinearProgress, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { TagAutocomplete } from "../components/AutocompleteFields";
import { api, apiUrl } from "../lib/api";
import type { Post } from "../lib/types";

interface Category { id: string; name: string }
interface UploadedFile { id: string }
type PostStatus = "draft" | "published";
type PostVisibility = "public" | "unlisted" | "private";
type PermalinkPattern = "user" | "posts";
type PermalinkIdType = "normalizedTitle" | "internalId" | "creationDate" | "custom";

function PostEditor() {
    const editing = location.pathname.includes("/edit/");
    const postId = editing ? decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-2)!) : null;
    const [post, setPost] = useState<Post | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [title, setTitle] = useState("");
    const [caption, setCaption] = useState("");
    const [description, setDescription] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [originalCreator, setOriginalCreator] = useState("");
    const [originalCreatedAt, setOriginalCreatedAt] = useState("");
    const [allowDownload, setAllowDownload] = useState(true);
    const [status, setStatus] = useState<PostStatus>("published");
    const [visibility, setVisibility] = useState<PostVisibility>("public");
    const [permalinkPattern, setPermalinkPattern] = useState<PermalinkPattern>("user");
    const [permalinkIdType, setPermalinkIdType] = useState<PermalinkIdType>("internalId");
    const [customPostId, setCustomPostId] = useState("");
    const [mergeIntoMultiPost, setMergeIntoMultiPost] = useState(false);
    const [tags, setTags] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState("");
    const [uploadStatus, setUploadStatus] = useState("");
    const [progress, setProgress] = useState(0);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        void Promise.all([
            api<{ data?: Category[] }>("/v1/categories?limit=100"),
            editing && postId ? api<{ data: Post }>(`/v1/posts/${encodeURIComponent(postId)}`) : Promise.resolve(null),
        ]).then(([categoryResponse, postResponse]) => {
            setCategories(categoryResponse.data ?? []);
            if (postResponse) {
                const value = postResponse.data;
                setPost(value); setTitle(value.title ?? ""); setCaption(value.caption ?? ""); setDescription(value.description ?? "");
                setSourceUrl(value.sourceUrl ?? ""); setOriginalCreator(value.originalCreator ?? "");
                setOriginalCreatedAt(value.originalCreatedAt ? value.originalCreatedAt.slice(0, 16) : "");
                setAllowDownload(value.allowDownload !== false); setStatus(value.status === "draft" ? "draft" : "published");
                setVisibility(value.visibility === "private" || value.visibility === "unlisted" ? value.visibility : "public");
                setPermalinkPattern(value.permalinkPattern === "posts" ? "posts" : "user");
                setPermalinkIdType(value.permalinkIdType === "normalizedTitle" || value.permalinkIdType === "creationDate" || value.permalinkIdType === "custom" ? value.permalinkIdType : "internalId");
                setCustomPostId(value.customPostId ?? "");
                setTags((value.tags ?? []).map((tag) => tag.name ?? tag.tag?.name ?? "").filter(Boolean).join(", ")); setCategoryId(value.category?.id ?? "");
            }
        }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load post editor."));
    }, [editing, postId]);

    function addFiles(next: FileList | File[]) {
        const selected = Array.from(next).filter((file) => file.type.startsWith("image/")); setFiles((current) => [...current, ...selected]);
        if (!title.trim() && selected[0]) setTitle(selected.length === 1 ? selected[0].name.replace(/\.[^.]+$/, "") : "");
    }
    function moveFile(index: number, delta: -1 | 1) { setFiles((current) => { const target = index + delta; if (target < 0 || target >= current.length) return current; const next = [...current]; const currentFile = next[index]; const targetFile = next[target]; if (!currentFile || !targetFile) return current; next[index] = targetFile; next[target] = currentFile; return next; }); }
    function removeFile(index: number) { setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index)); }
    function upload(file: File): Promise<UploadedFile> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest(); xhr.open("POST", apiUrl("/v1/uploads"));
            xhr.upload.onprogress = (event) => { if (!event.lengthComputable) return; setProgress((event.loaded / event.total) * 100); setUploadStatus(`Uploading ${file.name}… ${Math.round((event.loaded / event.total) * 100)}%`); };
            xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText).data as UploadedFile); } catch { reject(new Error("Invalid upload response.")); } } else reject(new Error(xhr.status === 429 ? "Upload rate limit exceeded." : "Image upload failed.")); };
            xhr.onerror = () => reject(new Error("Image upload failed.")); xhr.onabort = () => reject(new Error("Upload cancelled.")); const data = new FormData(); data.append("file", file); xhr.send(data);
        });
    }
    function originalCreatedAtValue() { return originalCreatedAt ? new Date(originalCreatedAt).toISOString() : null; }
    function permalinkValues() { return { permalinkPattern, permalinkIdType, customPostId: permalinkIdType === "custom" ? customPostId.trim() || null : null }; }
    async function createPost(uploadIds: string[], postTitle: string) {
        const response = await api<{ data: Post }>("/v1/posts", { method: "POST", body: JSON.stringify({ title: postTitle, caption: caption || null, description: description || null, sourceUrl: sourceUrl || null, originalCreator: originalCreator.trim() || null, originalCreatedAt: originalCreatedAtValue(), ...permalinkValues(), allowDownload, status: "draft", visibility, uploadIds, tags: tags.split(",").map((value) => value.trim()).filter(Boolean), categoryId: categoryId || null }) }); return response.data;
    }
    async function deletePost() {
        if (!postId || !window.confirm("Delete this post permanently? This cannot be undone.")) return; setSaving(true); setError("");
        try { await api(`/v1/posts/${encodeURIComponent(postId)}`, { method: "DELETE" }); location.href = "/dashboard/posts/"; }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete post."); setSaving(false); }
    }
    async function submit(event: React.FormEvent) {
        event.preventDefault(); setSaving(true); setError(""); setProgress(0); setUploadStatus("");
        try { const uploadIds: string[] = []; for (const file of files) { const uploaded = await upload(file); uploadIds.push(uploaded.id); } if (editing && postId) { await api(`/v1/posts/${encodeURIComponent(postId)}`, { method: "PATCH", body: JSON.stringify({ title: title.trim() || null, caption: caption || null, description: description || null, sourceUrl: sourceUrl || null, originalCreator: originalCreator.trim() || null, originalCreatedAt: originalCreatedAtValue(), ...permalinkValues(), allowDownload, status, visibility, uploadIds: uploadIds.length ? uploadIds : undefined, tags: tags.split(",").map((value) => value.trim()).filter(Boolean), categoryId: categoryId || null }) }); location.href = `/posts/${encodeURIComponent(postId)}/`; } else { const created = await createPost(uploadIds, title.trim() || "Untitled"); if (mergeIntoMultiPost) { location.href = `/dashboard/posts/${encodeURIComponent(created.id)}/edit/`; } else { location.href = `/posts/${encodeURIComponent(created.id)}/`; } } }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save post."); }
        finally { setSaving(false); }
    }

    return <Page title={editing ? "Edit post" : "Create post"}>
        <Card><CardContent component="form" onSubmit={submit}>
            <Stack spacing={2}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} fullWidth />
                <TextField label="Caption" value={caption} onChange={(event) => setCaption(event.target.value)} fullWidth />
                <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={4} fullWidth />
                <TextField label="Source URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} fullWidth />
                <TextField label="Original creator" value={originalCreator} onChange={(event) => setOriginalCreator(event.target.value)} fullWidth />
                <TextField label="Original created at" type="datetime-local" value={originalCreatedAt} onChange={(event) => setOriginalCreatedAt(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                <FormControlLabel control={<Checkbox checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} />} label="Allow downloads" />
                <FormControl fullWidth><InputLabel id="post-status-label">Status</InputLabel><Select labelId="post-status-label" value={status} label="Status" onChange={(event) => setStatus(event.target.value as PostStatus)}><MenuItem value="draft">Draft</MenuItem><MenuItem value="published">Published</MenuItem></Select></FormControl>
                <FormControl fullWidth><InputLabel id="post-visibility-label">Visibility</InputLabel><Select labelId="post-visibility-label" value={visibility} label="Visibility" onChange={(event) => setVisibility(event.target.value as PostVisibility)}><MenuItem value="public">Public</MenuItem><MenuItem value="unlisted">Unlisted</MenuItem><MenuItem value="private">Private</MenuItem></Select></FormControl>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><FormControl fullWidth><InputLabel id="permalink-pattern-label">Permalink pattern</InputLabel><Select labelId="permalink-pattern-label" value={permalinkPattern} label="Permalink pattern" onChange={(event) => setPermalinkPattern(event.target.value as PermalinkPattern)}><MenuItem value="user">User</MenuItem><MenuItem value="posts">Posts</MenuItem></Select></FormControl><FormControl fullWidth><InputLabel id="permalink-id-type-label">Permalink ID type</InputLabel><Select labelId="permalink-id-type-label" value={permalinkIdType} label="Permalink ID type" onChange={(event) => setPermalinkIdType(event.target.value as PermalinkIdType)}><MenuItem value="internalId">Internal ID</MenuItem><MenuItem value="normalizedTitle">Normalized title</MenuItem><MenuItem value="creationDate">Creation date</MenuItem><MenuItem value="custom">Custom</MenuItem></Select></FormControl></Stack>
                {permalinkIdType === "custom" ? <TextField label="Custom post ID" value={customPostId} onChange={(event) => setCustomPostId(event.target.value)} fullWidth /> : null}
                <TagAutocomplete value={tags} onChange={setTags} />
                <FormControl fullWidth><InputLabel id="post-category-label">Category</InputLabel><Select labelId="post-category-label" value={categoryId} label="Category" onChange={(event) => setCategoryId(event.target.value)}><MenuItem value="">None</MenuItem>{categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}</Select></FormControl>
                <FormControlLabel control={<Checkbox checked={mergeIntoMultiPost} onChange={(event) => setMergeIntoMultiPost(event.target.checked)} />} label="Continue editing after save" />
                <Stack spacing={1}>
                    <Typography variant="subtitle2">Images</Typography>
                    <Button component="label" variant="outlined">Choose images<input hidden type="file" accept="image/*" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /></Button>
                    {files.map((file, index) => <Card key={`${file.name}-${index}`} variant="outlined"><CardContent><Stack direction="row" spacing={1} alignItems="center"><Typography sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</Typography><IconButton onClick={() => moveFile(index, -1)} disabled={index === 0}><ArrowUpward /></IconButton><IconButton onClick={() => moveFile(index, 1)} disabled={index === files.length - 1}><ArrowDownward /></IconButton><IconButton color="error" onClick={() => removeFile(index)}><Delete /></IconButton></Stack></CardContent></Card>)}
                    {uploadStatus ? <Typography variant="body2">{uploadStatus}</Typography> : null}
                    {saving && progress > 0 ? <LinearProgress variant="determinate" value={progress} /> : null}
                </Stack>
                <Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create post"}</Button>
            </Stack>
        </CardContent></Card>
    </Page>;
}

createRoot(document.getElementById("root")!).render(<App><PostEditor /></App>);
