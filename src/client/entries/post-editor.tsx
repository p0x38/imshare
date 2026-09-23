import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Dialog,
    DialogContent,
    DialogTitle,
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
import { TagAutocomplete } from "../components/AutocompleteFields";
import { ProfilePictureCropper } from "../components/ProfilePictureCropper";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Category {
    id: string;
    name: string;
}
type PostStatus = "draft" | "published";
type PostVisibility = "public" | "unlisted" | "private";
type PermalinkPattern = "user" | "posts";
type PermalinkIdType = "normalizedTitle" | "internalId" | "creationDate" | "custom";

function PostEditor() {
    const editing = location.pathname.includes("/edit/");
    const postId = editing
        ? decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-2)!)
        : null;
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
    const [isNSFW, setIsNSFW] = useState(false);
    const [contentWarningType, setContentWarningType] = useState("none");
    const [contentWarning, setContentWarning] = useState("");
    const [permalinkPattern, setPermalinkPattern] = useState<PermalinkPattern>("user");
    const [permalinkIdType, setPermalinkIdType] = useState<PermalinkIdType>("internalId");
    const [customPostId, setCustomPostId] = useState("");
    const [mergeIntoMultiPost, setMergeIntoMultiPost] = useState(false);
    const [tags, setTags] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [initialUploadId, setInitialUploadId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [uploadStatus, setUploadStatus] = useState("");
    const [progress, setProgress] = useState(0);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [batchUploading, setBatchUploading] = useState(false);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailUploadId, setThumbnailUploadId] = useState<string | null>(null);
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
    const [thumbnailUploading, setThumbnailUploading] = useState(false);

    useEffect(() => {
        const uploadId = new URLSearchParams(location.search).get("uploadId");
        if (uploadId && !editing) setInitialUploadId(uploadId);
    }, [editing]);

    useEffect(() => {
        void Promise.all([
            api<{ data?: Category[] }>("/v1/categories?limit=100"),
            editing && postId
                ? api<{ data: Post }>(`/v1/posts/${encodeURIComponent(postId)}`)
                : Promise.resolve(null),
        ])
            .then(([categoryResponse, postResponse]) => {
                setCategories(categoryResponse.data ?? []);
                if (postResponse) {
                    const value = postResponse.data;
                    setPost(value);
                    setTitle(value.title ?? "");
                    setCaption(value.caption ?? "");
                    setDescription(value.description ?? "");
                    setSourceUrl(value.sourceUrl ?? "");
                    setOriginalCreator(value.originalCreator ?? "");
                    setOriginalCreatedAt(
                        value.originalCreatedAt ? value.originalCreatedAt.slice(0, 16) : "",
                    );
                    setAllowDownload(value.allowDownload !== false);
                    setStatus(value.status === "draft" ? "draft" : "published");
                    setVisibility(
                        value.visibility === "private" || value.visibility === "unlisted"
                            ? value.visibility
                            : "public",
                    );
                    setIsNSFW(value.isNSFW === true);
                    setContentWarningType(value.contentWarningType ?? "none");
                    setContentWarning(value.contentWarning ?? "");
                    setPermalinkPattern(value.permalinkPattern === "posts" ? "posts" : "user");
                    setPermalinkIdType(
                        value.permalinkIdType === "normalizedTitle" ||
                            value.permalinkIdType === "creationDate" ||
                            value.permalinkIdType === "custom"
                            ? value.permalinkIdType
                            : "internalId",
                    );
                    setCustomPostId(value.customPostId ?? "");
                    setTags(
                        (value.tags ?? [])
                            .map((tag) => tag.name ?? tag.tag?.name ?? "")
                            .filter(Boolean)
                            .join(", "),
                    );
                    setCategoryId(value.category?.id ?? "");
                    setThumbnailUploadId(value.thumbnailUploadId ?? null);
                    setThumbnailPreviewUrl(
                        value.thumbnailUrl ? new URL(value.thumbnailUrl, window.location.origin).href : null,
                    );
                }
            })
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : "Unable to load post editor."),
            );
    }, [editing, postId]);

    function originalCreatedAtValue() {
        return originalCreatedAt ? new Date(originalCreatedAt).toISOString() : null;
    }
    function permalinkValues() {
        return {
            permalinkPattern,
            permalinkIdType,
            customPostId: permalinkIdType === "custom" ? customPostId.trim() || null : null,
        };
    }
    async function createPost(
        uploadIds: string[],
        postTitle: string,
        forceStatus?: PostStatus,
    ) {
        const response = await api<{ data: Post }>("/v1/posts", {
            method: "POST",
            body: JSON.stringify({
                title: postTitle,
                caption: caption || null,
                description: description || null,
                sourceUrl: sourceUrl || null,
                originalCreator: originalCreator.trim() || null,
                originalCreatedAt: originalCreatedAtValue(),
                ...permalinkValues(),
                allowDownload,
                status: forceStatus ?? status,
                visibility,
                isNSFW,
                contentWarningType: contentWarningType === "none" ? null : contentWarningType,
                contentWarning: contentWarning.trim() || null,
                uploadIds,
                tags: tags
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                categoryId: categoryId || null,
                thumbnailUploadId,
            }),
        });
        return response.data;
    }
    async function deletePost() {
        if (!postId || !window.confirm("Delete this post permanently? This cannot be undone."))
            return;
        setSaving(true);
        setError("");
        try {
            await api(`/v1/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
            location.href = "/dashboard/posts/";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to delete post.");
            setSaving(false);
        }
    }
    async function uploadThumbnail(blob: Blob) {
        setThumbnailUploading(true);
        try {
            const file = new File([blob], "thumbnail.png", { type: "image/png" });
            const form = new FormData();
            form.append("file", file);
            const response = await api<{ data: { id: string; url?: string } }>("/v1/uploads", {
                method: "POST",
                body: form,
            });
            setThumbnailUploadId(response.data.id);
            setThumbnailPreviewUrl(
                response.data.url
                    ? new URL(response.data.url, window.location.origin).href
                    : URL.createObjectURL(blob),
            );
            setThumbnailFile(null);
        } finally {
            setThumbnailUploading(false);
        }
    }

    function chooseThumbnail(file: File | undefined) {
        if (!file) return;
        setThumbnailFile(file);
    }

    function clearThumbnail() {
        setThumbnailUploadId(null);
        setThumbnailPreviewUrl(null);
        setThumbnailFile(null);
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            const uploadIds: string[] = initialUploadId ? [initialUploadId] : [];

            if (editing && postId) {
                await api(`/v1/posts/${encodeURIComponent(postId)}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        title: title.trim() || null,
                        caption: caption || null,
                        description: description || null,
                        sourceUrl: sourceUrl || null,
                        originalCreator: originalCreator.trim() || null,
                        originalCreatedAt: originalCreatedAtValue(),
                        ...permalinkValues(),
                        allowDownload,
                        status,
                        visibility,
                        isNSFW,
                        contentWarningType:
                            contentWarningType === "none" ? null : contentWarningType,
                        contentWarning: contentWarning.trim() || null,
                        uploadIds: uploadIds.length ? uploadIds : undefined,
                        tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
                        categoryId: categoryId || null,
                        thumbnailUploadId,
                    }),
                });
                location.href = `/posts/${encodeURIComponent(postId)}/`;
                return;
            }

            if (!uploadIds.length)
                throw new Error("Choose an image from the upload box first.");

            const created = await createPost(uploadIds, title.trim() || "Untitled");
            location.href = mergeIntoMultiPost
                ? `/dashboard/posts/${encodeURIComponent(created.id)}/edit/`
                : `/posts/${encodeURIComponent(created.id)}/`;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save post.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Page title={editing ? "Edit post" : "Create post"}>
            <Card>
                <CardContent component="form" onSubmit={submit}>
                    <Stack spacing={2}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        <Stack spacing={1.5}>
                            <Typography variant="h6" component="h2">
                                Image
                            </Typography>
                            {initialUploadId ? (
                                <Alert severity="success">
                                    Image uploaded. Finish the post details below.
                                </Alert>
                            ) : (
                                <Alert severity="info">
                                    Use the upload box above to add an image.
                                </Alert>
                            )}
                        </Stack>
                        <Stack spacing={1}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={isNSFW}
                                        onChange={(event) => setIsNSFW(event.target.checked)}
                                    />
                                }
                                label="Is content NSFW?"
                            />
                            <TextField
                                select
                                label="Type of Content Warning"
                                value={contentWarningType}
                                onChange={(event) => setContentWarningType(event.target.value)}
                                fullWidth
                            >
                                <MenuItem value="none">None</MenuItem>
                                <MenuItem value="sexual">Sexual content</MenuItem>
                                <MenuItem value="violence">Violence</MenuItem>
                                <MenuItem value="gore">Gore</MenuItem>
                                <MenuItem value="drugs">Drugs</MenuItem>
                                <MenuItem value="flashing">Flashing lights</MenuItem>
                                <MenuItem value="spoilers">Spoilers</MenuItem>
                                <MenuItem value="other">Other</MenuItem>
                            </TextField>
                            <TextField
                                label="Content Warning"
                                value={contentWarning}
                                onChange={(event) => setContentWarning(event.target.value)}
                                helperText="Optional text shown with the warning."
                                fullWidth
                            />
                        </Stack>
                        <Stack spacing={1.5}>
                            <Typography variant="h6" component="h2">
                                Custom thumbnail
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Choose a thumbnail image and crop it to an exact 1:1 square.
                            </Typography>
                            <Card
                                variant="outlined"
                                sx={{
                                    position: "relative",
                                    overflow: "hidden",
                                    borderStyle: "dashed",
                                    minHeight: 180,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: "action.hover",
                                }}
                            >
                                {thumbnailPreviewUrl ? (
                                    <Box
                                        component="img"
                                        src={thumbnailPreviewUrl}
                                        alt="Custom thumbnail preview"
                                        sx={{
                                            width: "100%",
                                            maxHeight: 260,
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : (
                                    <Stack spacing={1} alignItems="center" sx={{ p: 3, textAlign: "center" }}>
                                        <Typography fontWeight={600}>Drop an image here or choose one</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            The same four-point 1:1 crop box used for profile pictures.
                                        </Typography>
                                    </Stack>
                                )}
                                <Button
                                    component="label"
                                    variant={thumbnailPreviewUrl ? "outlined" : "contained"}
                                    disabled={thumbnailUploading}
                                    sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)" }}
                                >
                                    {thumbnailPreviewUrl ? "Replace thumbnail" : "Choose thumbnail"}
                                    <input
                                        hidden
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif"
                                        onChange={(event) => {
                                            chooseThumbnail(event.target.files?.[0]);
                                            event.currentTarget.value = "";
                                        }}
                                    />
                                </Button>
                            </Card>
                            {thumbnailPreviewUrl ? (
                                <Button color="inherit" size="small" onClick={clearThumbnail} disabled={thumbnailUploading}>
                                    Remove custom thumbnail
                                </Button>
                            ) : null}
                        </Stack>
                        <TextField
                            label="Title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Caption"
                            value={caption}
                            onChange={(event) => setCaption(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            multiline
                            minRows={4}
                            fullWidth
                        />
                        <TextField
                            label="Source URL"
                            value={sourceUrl}
                            onChange={(event) => setSourceUrl(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Original creator"
                            value={originalCreator}
                            onChange={(event) => setOriginalCreator(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Original created at"
                            type="datetime-local"
                            value={originalCreatedAt}
                            onChange={(event) => setOriginalCreatedAt(event.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allowDownload}
                                    onChange={(event) => setAllowDownload(event.target.checked)}
                                />
                            }
                            label="Allow downloads"
                        />
                        <FormControl fullWidth>
                            <InputLabel id="post-status-label">Status</InputLabel>
                            <Select
                                labelId="post-status-label"
                                value={status}
                                label="Status"
                                onChange={(event) => setStatus(event.target.value as PostStatus)}
                            >
                                <MenuItem value="draft">Draft</MenuItem>
                                <MenuItem value="published">Published</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel id="post-visibility-label">Visibility</InputLabel>
                            <Select
                                labelId="post-visibility-label"
                                value={visibility}
                                label="Visibility"
                                onChange={(event) =>
                                    setVisibility(event.target.value as PostVisibility)
                                }
                            >
                                <MenuItem value="public">Public</MenuItem>
                                <MenuItem value="unlisted">Unlisted</MenuItem>
                                <MenuItem value="private">Private</MenuItem>
                            </Select>
                        </FormControl>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel id="permalink-pattern-label">
                                    Permalink pattern
                                </InputLabel>
                                <Select
                                    labelId="permalink-pattern-label"
                                    value={permalinkPattern}
                                    label="Permalink pattern"
                                    onChange={(event) =>
                                        setPermalinkPattern(event.target.value as PermalinkPattern)
                                    }
                                >
                                    <MenuItem value="user">User</MenuItem>
                                    <MenuItem value="posts">Posts</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel id="permalink-id-type-label">
                                    Permalink ID type
                                </InputLabel>
                                <Select
                                    labelId="permalink-id-type-label"
                                    value={permalinkIdType}
                                    label="Permalink ID type"
                                    onChange={(event) =>
                                        setPermalinkIdType(event.target.value as PermalinkIdType)
                                    }
                                >
                                    <MenuItem value="internalId">Internal ID</MenuItem>
                                    <MenuItem value="normalizedTitle">Normalized title</MenuItem>
                                    <MenuItem value="creationDate">Creation date</MenuItem>
                                    <MenuItem value="custom">Custom</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                        {permalinkIdType === "custom" ? (
                            <TextField
                                label="Custom post ID"
                                value={customPostId}
                                onChange={(event) => setCustomPostId(event.target.value)}
                                fullWidth
                            />
                        ) : null}
                        <TagAutocomplete value={tags} onChange={setTags} />
                        <FormControl fullWidth>
                            <InputLabel id="post-category-label">Category</InputLabel>
                            <Select
                                labelId="post-category-label"
                                value={categoryId}
                                label="Category"
                                onChange={(event) => setCategoryId(event.target.value)}
                            >
                                <MenuItem value="">None</MenuItem>
                                {categories.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={mergeIntoMultiPost}
                                    onChange={(event) =>
                                        setMergeIntoMultiPost(event.target.checked)
                                    }
                                />
                            }
                            label="Continue editing after save"
                        />
                        <Button type="submit" variant="contained" disabled={saving}>
                            {saving ? "Saving…" : editing ? "Save changes" : "Create post"}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
            <Dialog
                open={thumbnailFile !== null}
                onClose={() => {
                    if (!thumbnailUploading) setThumbnailFile(null);
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Crop custom thumbnail</DialogTitle>
                <DialogContent>
                    {thumbnailFile ? (
                        <ProfilePictureCropper
                            file={thumbnailFile}
                            showCircle={false}
                            actionLabel="Use this thumbnail"
                            onCancel={() => setThumbnailFile(null)}
                            onConfirm={uploadThumbnail}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </Page>
    );
}

const root = document.querySelector("#post-editor-page");
if (root)
    createRoot(root).render(
        <App>
            <PostEditor />
        </App>,
    );
