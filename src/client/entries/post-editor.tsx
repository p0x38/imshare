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
import type { ContentFormat, Post } from "../lib/types";
import { ContentEditor } from "../lib/content-formats/ContentEditor";
import { normalizeContentFormat } from "../lib/content-formats/formats";
import { useTranslation } from "react-i18next";

interface Category {
    id: string;
    name: string;
}
type PostStatus = "draft" | "published";
type PostVisibility = "public" | "unlisted" | "private";
type PermalinkPattern = "user" | "posts";
type PermalinkIdType = "normalizedTitle" | "internalId" | "creationDate" | "custom";

type CrawlerOverride = "inherit" | "allow" | "deny";

const crawlerOptions = [
    {
        key: "allowSearchEngineIndex",
    },
    {
        key: "allowAiCrawler",
    },
    {
        key: "allowImageCrawler",
    },
    {
        key: "allowCustomCrawler",
    },
] as const;

type CrawlerField = (typeof crawlerOptions)[number]["key"];

function toCrawlerOverride(value: boolean | null | undefined): CrawlerOverride {
    if (value === true) return "allow";
    if (value === false) return "deny";
    return "inherit";
}

function fromCrawlerOverride(value: CrawlerOverride): boolean | null {
    if (value === "allow") return true;
    if (value === "deny") return false;
    return null;
}

function PostEditor() {
    const { t } = useTranslation(["editor", "common"]);
    const editing = location.pathname.includes("/edit/");
    const postId = editing
        ? decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-2)!)
        : null;
    const [post, setPost] = useState<Post | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [title, setTitle] = useState("");
    const [caption, setCaption] = useState("");
    const [description, setDescription] = useState("");
    const [contentFormat, setContentFormat] = useState<ContentFormat>("plain");
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
    const [crawlerOverrides, setCrawlerOverrides] = useState<Record<CrawlerField, CrawlerOverride>>(
        {
            allowSearchEngineIndex: "inherit",
            allowAiCrawler: "inherit",
            allowImageCrawler: "inherit",
            allowCustomCrawler: "inherit",
        },
    );

    function crawlerPolicyValues() {
        return {
            allowSearchEngineIndex: fromCrawlerOverride(crawlerOverrides.allowSearchEngineIndex),
            allowAiCrawler: fromCrawlerOverride(crawlerOverrides.allowAiCrawler),
            allowImageCrawler: fromCrawlerOverride(crawlerOverrides.allowImageCrawler),
            allowCustomCrawler: fromCrawlerOverride(crawlerOverrides.allowCustomCrawler),
        };
    }

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
                    setContentFormat(normalizeContentFormat(value.contentFormat));
                    setSourceUrl(value.sourceUrl ?? "");
                    setOriginalCreator(value.originalCreator ?? "");
                    setOriginalCreatedAt(
                        value.originalCreatedAt ? value.originalCreatedAt.slice(0, 16) : "",
                    );
                    setAllowDownload(value.allowDownload !== false);
                    setCrawlerOverrides({
                        allowSearchEngineIndex: toCrawlerOverride(value.allowSearchEngineIndex),
                        allowAiCrawler: toCrawlerOverride(value.allowAiCrawler),
                        allowImageCrawler: toCrawlerOverride(value.allowImageCrawler),
                        allowCustomCrawler: toCrawlerOverride(value.allowCustomCrawler),
                    });
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
                        value.thumbnailUrl
                            ? new URL(value.thumbnailUrl, window.location.origin).href
                            : null,
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
    async function createPost(uploadIds: string[], postTitle: string, forceStatus?: PostStatus) {
        const response = await api<{ data: Post }>("/v1/posts", {
            method: "POST",
            body: JSON.stringify({
                title: postTitle,
                caption: caption || null,
                description: description || null,
                contentFormat,
                sourceUrl: sourceUrl || null,
                originalCreator: originalCreator.trim() || null,
                originalCreatedAt: originalCreatedAtValue(),
                ...permalinkValues(),
                allowDownload,
                ...crawlerPolicyValues(),
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
                        contentFormat,
                        sourceUrl: sourceUrl || null,
                        originalCreator: originalCreator.trim() || null,
                        originalCreatedAt: originalCreatedAtValue(),
                        ...permalinkValues(),
                        allowDownload,
                        ...crawlerPolicyValues(),
                        status,
                        visibility,
                        isNSFW,
                        contentWarningType:
                            contentWarningType === "none" ? null : contentWarningType,
                        contentWarning: contentWarning.trim() || null,
                        uploadIds: uploadIds.length ? uploadIds : undefined,
                        tags: tags
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        categoryId: categoryId || null,
                        thumbnailUploadId,
                    }),
                });
                location.href = `/posts/${encodeURIComponent(postId)}/`;
                return;
            }

            if (!uploadIds.length) throw new Error("Choose an image from the upload box first.");

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
        <Page title={editing ? t("postEditor.editPost") : t("postEditor.newPost")}>
            <Card>
                <CardContent component="form" onSubmit={submit}>
                    <Stack spacing={2}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        <Stack spacing={1.5}>
                            <Typography variant="h6" component="h2">
                                {t("common:postMetadata.image")}
                            </Typography>
                            {initialUploadId ? (
                                <Alert severity="success">{t("postEditor.uploadSuccess")}</Alert>
                            ) : (
                                <Alert severity="info">{t("postEditor.dropImageAbove")}</Alert>
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
                                label={t("common:postMetadata.isNSFW")}
                            />
                            <TextField
                                select
                                label={t("common:postMetadata.contentWarningType")}
                                value={contentWarningType}
                                onChange={(event) => setContentWarningType(event.target.value)}
                                fullWidth
                            >
                                <MenuItem value="none">
                                    {t("common:contentWarningType.none")}
                                </MenuItem>
                                <MenuItem value="sexual">
                                    {t("common:contentWarningType.sexual")}
                                </MenuItem>
                                <MenuItem value="violence">
                                    {t("common:contentWarningType.violence")}
                                </MenuItem>
                                <MenuItem value="gore">
                                    {t("common:contentWarningType.gore")}
                                </MenuItem>
                                <MenuItem value="drugs">
                                    {t("common:contentWarningType.drugs")}
                                </MenuItem>
                                <MenuItem value="flashing">
                                    {t("common:contentWarningType.flashing")}
                                </MenuItem>
                                <MenuItem value="spoilers">
                                    {t("common:contentWarningType.spoilers")}
                                </MenuItem>
                                <MenuItem value="other">
                                    {t("common:contentWarningType.other")}
                                </MenuItem>
                            </TextField>
                            <TextField
                                label={t("common:postMetadata.contentWarning")}
                                value={contentWarning}
                                onChange={(event) => setContentWarning(event.target.value)}
                                helperText={t("common:postMetadataDescription.contentWarning")}
                                fullWidth
                            />
                            <FormControl fullWidth>
                                <InputLabel id="post-content-format-label">
                                    {t("common:postMetadata.contentFormat")}
                                </InputLabel>
                                <Select
                                    labelId="post-content-format-label"
                                    value={contentFormat}
                                    label={t("common:postMetadata.contentFormat")}
                                    onChange={(event) => {
                                        setContentFormat(
                                            normalizeContentFormat(event.target.value),
                                        );
                                    }}
                                >
                                    <MenuItem value="plain">
                                        {t("common:contentFormatType.plain")}
                                    </MenuItem>
                                    <MenuItem value="markdown">
                                        {t("common:contentFormatType.markdown")}
                                    </MenuItem>
                                    <MenuItem value="wikitext">
                                        {t("common:contentFormatType.wikitext")}
                                    </MenuItem>
                                </Select>
                            </FormControl>
                            <ContentEditor
                                label={t("common:postMetadata.caption")}
                                value={caption}
                                onChange={setCaption}
                                format={contentFormat}
                                showFormatSelector={false}
                                required={false}
                                minRows={3}
                                defaultMode="write"
                            />
                            <ContentEditor
                                label={t("common:postMetadata.description")}
                                value={description}
                                onChange={setDescription}
                                format={contentFormat}
                                showFormatSelector={false}
                                required={false}
                                minRows={5}
                                defaultMode="write"
                            />
                        </Stack>
                        <Stack spacing={1.5}>
                            <Typography variant="h6" component="h2">
                                {t("common:postMetadata.customThumbnail")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("common:postMetadataDescription.customThumbnail")}
                            </Typography>
                            <Card
                                variant="outlined"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    chooseThumbnail(event.dataTransfer.files?.[0]);
                                }}
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
                                        alt={t("common:postMetadataDescription.customThumbnailAlt")}
                                        sx={{
                                            width: "100%",
                                            maxHeight: 260,
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : (
                                    <Stack
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ p: 3, textAlign: "center" }}
                                    >
                                        <Typography fontWeight={600}>
                                            {t("postEditor.dropImages")}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("postEditor.squareImage")}
                                        </Typography>
                                    </Stack>
                                )}
                                <Button
                                    component="label"
                                    variant={thumbnailPreviewUrl ? "outlined" : "contained"}
                                    disabled={thumbnailUploading}
                                    sx={{
                                        position: "absolute",
                                        bottom: 12,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                    }}
                                >
                                    {thumbnailPreviewUrl
                                        ? t("postEditor.replaceThumbnail")
                                        : t("postEditor.chooseThumbnail")}
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
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={clearThumbnail}
                                    disabled={thumbnailUploading}
                                >
                                    {t("postEditor.removeThumbnail")}
                                </Button>
                            ) : null}
                        </Stack>
                        <TextField
                            label={t("common:postMetadata.title")}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t("common:postMetadata.caption")}
                            value={caption}
                            onChange={(event) => setCaption(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t("common:postMetadata.description")}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            multiline
                            minRows={4}
                            fullWidth
                        />
                        <TextField
                            label={t("common:postMetadata.sourceURL")}
                            value={sourceUrl}
                            onChange={(event) => setSourceUrl(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t("common:postMetadata.originalCreator")}
                            value={originalCreator}
                            onChange={(event) => setOriginalCreator(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t("common:postMetadata.originalCreatedAt")}
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
                            label={t("common:postMetadata.allowDownloads")}
                        />
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={2}>
                                    <Typography variant="h6" component="h2">
                                        {t("common:crawlerAccessMetadata.description")}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary">
                                        {t("common:crawlerAccessMetadata.help")}
                                    </Typography>

                                    {crawlerOptions.map(({ key }) => (
                                        <FormControl fullWidth key={key}>
                                            <InputLabel id={`${key}-label`}>
                                                {t(`common:crawlerAccessMetadata.${key}`)}
                                            </InputLabel>

                                            <Select
                                                labelId={`${key}-label`}
                                                value={crawlerOverrides[key]}
                                                label={t(`common:crawlerAccessMetadata.${key}`)}
                                                onChange={(event) => {
                                                    setCrawlerOverrides((current) => ({
                                                        ...current,
                                                        [key]: event.target
                                                            .value as CrawlerOverride,
                                                    }));
                                                }}
                                            >
                                                <MenuItem value="inherit">
                                                    {t(
                                                        "common:crawlerAccessMetadata.useAccountDefault",
                                                    )}
                                                </MenuItem>

                                                <MenuItem value="allow">
                                                    {t("common:crawlerAccessMetadata.allow")}
                                                </MenuItem>

                                                <MenuItem value="deny">
                                                    {t("common:crawlerAccessMetadata.deny")}
                                                </MenuItem>
                                            </Select>
                                        </FormControl>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                        <FormControl fullWidth>
                            <InputLabel id="post-status-label">Status</InputLabel>
                            <Select
                                labelId="post-status-label"
                                value={status}
                                label={t("common:postMetadata.status")}
                                onChange={(event) => setStatus(event.target.value as PostStatus)}
                            >
                                <MenuItem value="draft">{t("common:statusType.draft")}</MenuItem>
                                <MenuItem value="published">
                                    {t("common:statusType.published")}
                                </MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel id="post-visibility-label">
                                {t("common:postMetadata.visibility")}
                            </InputLabel>
                            <Select
                                labelId="post-visibility-label"
                                value={visibility}
                                label="Visibility"
                                onChange={(event) =>
                                    setVisibility(event.target.value as PostVisibility)
                                }
                            >
                                <MenuItem value="public">
                                    {t("common:visibilityType.public")}
                                </MenuItem>
                                <MenuItem value="unlisted">
                                    {t("common:visibilityType.unlisted")}
                                </MenuItem>
                                <MenuItem value="private">
                                    {t("common:visibilityType.private")}
                                </MenuItem>
                            </Select>
                        </FormControl>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel id="permalink-pattern-label">
                                    {t("common:postMetadata.permalinkPattern")}
                                </InputLabel>
                                <Select
                                    labelId="permalink-pattern-label"
                                    value={permalinkPattern}
                                    label={t("common:postMetadata.permalinkPattern")}
                                    onChange={(event) =>
                                        setPermalinkPattern(event.target.value as PermalinkPattern)
                                    }
                                >
                                    <MenuItem value="user">
                                        {t("common:permalinkPatternType.user")}
                                    </MenuItem>
                                    <MenuItem value="posts">
                                        {t("common:permalinkPatternType.posts")}
                                    </MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel id="permalink-id-type-label">
                                    {t("common:postMetadata.permalinkIdType")}
                                </InputLabel>
                                <Select
                                    labelId="permalink-id-type-label"
                                    value={t("common:postMetadata.permalinkIdType")}
                                    label="Permalink ID type"
                                    onChange={(event) =>
                                        setPermalinkIdType(event.target.value as PermalinkIdType)
                                    }
                                >
                                    <MenuItem value="internalId">
                                        {t("common:permalinkIdType.internalId")}
                                    </MenuItem>
                                    <MenuItem value="normalizedTitle">
                                        {t("common:permalinkIdType.normalizedTitle")}
                                    </MenuItem>
                                    <MenuItem value="creationDate">
                                        {t("common:permalinkIdType.creationDate")}
                                    </MenuItem>
                                    <MenuItem value="custom">
                                        {t("common:permalinkIdType.custom")}
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                        {permalinkIdType === "custom" ? (
                            <TextField
                                label={t("common:postMetadata.customPostId")}
                                value={customPostId}
                                onChange={(event) => setCustomPostId(event.target.value)}
                                fullWidth
                            />
                        ) : null}
                        <TagAutocomplete value={tags} onChange={setTags} />
                        <FormControl fullWidth>
                            <InputLabel id="post-category-label">
                                {t("common:postMetadata.category")}
                            </InputLabel>
                            <Select
                                labelId="post-category-label"
                                value={categoryId}
                                label={t("common:postMetadata.category")}
                                onChange={(event) => setCategoryId(event.target.value)}
                            >
                                <MenuItem value="">{t("postEditor.noCategory")}</MenuItem>
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
                            label={t("postEditor.keepEditingModeAfterSave")}
                        />
                        <Button type="submit" variant="contained" disabled={saving}>
                            {saving
                                ? t("postEditor.saving")
                                : editing
                                  ? t("postEditor.saveChanges")
                                  : t("postEditor.submitNewPost")}
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
                <DialogTitle>{t("postEditor.cropThumbnail")}</DialogTitle>
                <DialogContent>
                    {thumbnailFile ? (
                        <ProfilePictureCropper
                            file={thumbnailFile}
                            showCircle={false}
                            actionLabel={t("postEditor.useThisThumbnail")}
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
