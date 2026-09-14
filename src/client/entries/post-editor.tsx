import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    LinearProgress,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Category { id: string; name: string }
interface UploadedFile { id: string }

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

    function addFiles(next: FileList | File[]) {
        setFiles((current) => [...current, ...Array.from(next).filter((file) => file.type.startsWith("image/"))]);
    }

    function moveFile(index: number, delta: -1 | 1) {
        setFiles((current) => {
            const target = index + delta;
            if (target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    }

    function removeFile(index: number) {
        setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    }

    function upload(file: File): Promise<UploadedFile> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/v1/uploads");
            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                setProgress((event.loaded / event.total) * 100);
                setUploadStatus(`Uploading ${file.name}… ${Math.round((event.loaded / event.total) * 100)}%`);
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText).data as UploadedFile); }
                    catch { reject(new Error("Invalid upload response.")); }
                } else reject(new Error(xhr.status === 429 ? "Upload rate limit exceeded." : "Image upload failed."));
            };
            xhr.onerror = () => reject(new Error("Image upload failed."));
            xhr.onabort = () => reject(new Error("Upload cancelled."));
            const data = new FormData();
            data.append("file", file);
            xhr.send(data);
        });
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault(); setSaving(true); setError(""); setProgress(0); setUploadStatus("");
        try {
            let uploadIds: string[] = [];
            if (!editing) {
                if (!files.length) throw new Error("Please choose at least one image.");
                const uploads: UploadedFile[] = [];
                for (let index = 0; index < files.length; index++) {
                    setUploadStatus(`Processing ${index + 1}/${files.length} images…`);
                    uploads.push(await upload(files[index]!));
                }
                uploadIds = uploads.map((upload) => upload.id);
                setProgress(100);
                setUploadStatus("All uploads ready");
            }
            const payload = {
                title,
                caption: caption || null,
                description: description || null,
                sourceUrl: sourceUrl || null,
                allowDownload,
                ...(editing ? {} : { uploadIds }),
                tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
                categoryId: categoryId || null,
            };
            const response = await api<{ data: Post }>(editing ? `/v1/posts/${encodeURIComponent(postId!)}` : "/v1/posts", {
                method: editing ? "PATCH" : "POST",
                body: JSON.stringify(payload),
            });
            location.href = editing ? `/dashboard/posts/${encodeURIComponent(response.data.id)}/` : `/posts/${encodeURIComponent(response.data.id)}`;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save post.");
        } finally { setSaving(false); }
    }

    if (editing && !post && !error) return <Page><Typography>Loading…</Typography></Page>;
    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">{editing ? "Edit Post" : "New Post"}</Typography>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Card variant="outlined">
                    <CardContent>
                        <Stack component="form" spacing={2} onSubmit={submit}>
                            {!editing ? (
                                <Box
                                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
                                    sx={{ p: 2, border: 1, borderColor: dragging ? "primary.main" : "divider", borderRadius: 2, bgcolor: dragging ? "action.hover" : "transparent" }}
                                >
                                    <Button variant="outlined" component="label">Choose images<input hidden type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files ?? [])} /></Button>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Drop images here or use the file picker.</Typography>
                                    {files.length ? <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1.5, mt: 2 }}>{files.map((file, index) => <Card key={`${file.name}-${index}`} variant="outlined"><Box component="img" src={URL.createObjectURL(file)} alt={file.name} sx={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} /><CardContent sx={{ p: 1 }}><Typography variant="body2" noWrap>{index + 1}. {file.name}</Typography><Stack direction="row" spacing={0.25} justifyContent="flex-end"><IconButton size="small" aria-label="Move image up" disabled={index === 0} onClick={() => moveFile(index, -1)}><ArrowUpward fontSize="small" /></IconButton><IconButton size="small" aria-label="Move image down" disabled={index === files.length - 1} onClick={() => moveFile(index, 1)}><ArrowDownward fontSize="small" /></IconButton><IconButton size="small" color="error" aria-label="Remove image" onClick={() => removeFile(index)}><Delete fontSize="small" /></IconButton></Stack></CardContent></Card>)}</Box> : null}
                                </Box>
                            ) : null}
                            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required inputProps={{ maxLength: 200 }} />
                            <TextField label="Image caption" value={caption} onChange={(e) => setCaption(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 10000 }} />
                            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={4} />
                            <TextField label="Source URL" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                            <FormControlLabel control={<Checkbox checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />} label="Allow visitors to download the original image" />
                            <TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} helperText="Separate tags with commas" />
                            <FormControl fullWidth><InputLabel id="category-label">Category</InputLabel><Select labelId="category-label" label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><MenuItem value="">None</MenuItem>{categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}</Select></FormControl>
                            {saving && !editing ? <Stack spacing={0.5}><LinearProgress variant={progress ? "determinate" : "indeterminate"} value={progress} /><Typography variant="body2" color="text.secondary">{uploadStatus}</Typography></Stack> : null}
                            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create post"}</Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#post-editor-page");
if (root) createRoot(root).render(<App><PostEditor /></App>);
