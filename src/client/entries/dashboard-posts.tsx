import {
    Alert,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CardMedia,
    Stack,
    Tooltip,
    Typography,
    Checkbox,
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Menu,
    MenuItem,
    Pagination,
    TextField,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { TextList } from "../components/TextList";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { api } from "../lib/api";
import type { Post } from "../lib/types";
function imageUrl(url: string, width = 512): string {
    const image = new URL(url, window.location.origin);
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
}
interface PostRevision {
    id: string;
    title: string;
    description?: string | null;
    createdAt: string;
}

function postPublicUrl(post: Post): string {
    return new URL(
        post.permalink ?? "/posts/" + encodeURIComponent(post.id) + "/",
        window.location.origin,
    ).href;
}

function postOriginalUrl(post: Post): string | null {
    const upload = post.uploads?.[0];
    if (!upload) return null;
    const url = new URL(upload.url, window.location.origin);
    url.searchParams.set("download", "true");
    return url.href;
}
function DashboardPostsPage() {
    const { t } = useTranslation();
    const [posts, setPosts] = useState<Post[] | null>(null);
    const [error, setError] = useState("");
    const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
    const [merging, setMerging] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [menuPost, setMenuPost] = useState<Post | null>(null);
    const [splitBusy, setSplitBusy] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    const [page, setPage] = useState(() => {
        const value = Number(new URLSearchParams(location.search).get("page"));
        return Number.isInteger(value) && value > 0 ? value : 1;
    });
    const [total, setTotal] = useState(0);
    const [convertSelection, setConvertSelection] = useState<string[]>([]);
    const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
    const [batchEditOpen, setBatchEditOpen] = useState(false);
    const [batchEditing, setBatchEditing] = useState(false);
    const [batchVisibility, setBatchVisibility] = useState("");
    const [batchStatus, setBatchStatus] = useState("");
    const [batchAllowDownload, setBatchAllowDownload] = useState("");
    const [batchContentWarning, setBatchContentWarning] = useState("");
    const [batchClearContentWarning, setBatchClearContentWarning] = useState(false);
    const [batchTags, setBatchTags] = useState("");
    const [revisionsOpen, setRevisionsOpen] = useState(false);
    const [revisions, setRevisions] = useState<PostRevision[]>([]);
    const [revisionsLoading, setRevisionsLoading] = useState(false);
    const imagePosts = posts?.filter((post) => post.contentType !== "text") ?? [];
    const texts = posts?.filter((post) => post.contentType === "text") ?? [];
    const drafts = imagePosts.filter((post) => post.status === "draft");
    const selectedPosts = posts?.filter((post) => selectedPostIds.includes(post.id)) ?? [];
    const selectedDraftIds = selectedPosts
        .filter((post) => post.contentType === "image" && post.status === "draft")
        .map((post) => post.id);
    const allPostIds = posts?.map((post) => post.id) ?? [];
    const allSelected = allPostIds.length > 0 && selectedPostIds.length === allPostIds.length;
    const partiallySelected = selectedPostIds.length > 0 && !allSelected;
    const canCombineSelected = selectedDraftIds.length >= 2 && selectedDraftIds.length === selectedPosts.length;
    const loadPosts = useCallback(
        async (targetPage: number) => {
            setError("");
            try {
                const response = await api<{
                    data?: Post[];
                    pagination?: { page?: number; total?: number; totalPages?: number };
                }>(`/v1/me/posts?limit=100&page=${targetPage}`);
                const resolvedPage = response.pagination?.page ?? targetPage;
                setPosts(response.data ?? []);
                const resolvedTotal = response.pagination?.total ?? 0;
                const resolvedTotalPages =
                    response.pagination?.totalPages ?? Math.ceil(resolvedTotal / 100);
                setTotal(resolvedTotal);
                setPage(resolvedPage);
                const historyParams = new URLSearchParams();
                if (resolvedPage > 1) historyParams.set("page", String(resolvedPage));
                history.replaceState(
                    null,
                    "",
                    historyParams.toString() ? `?${historyParams}` : location.pathname,
                );
                return {
                    page: resolvedPage,
                    total: resolvedTotal,
                    totalPages: resolvedTotalPages,
                };
            } catch (cause) {
                const status = (cause as Error & { status?: number }).status;
                if (status === 401) {
                    window.location.href = "/account/login/";
                    return;
                }
                setError(cause instanceof Error ? cause.message : t("dashboardPosts.loadError"));
                setPosts(null);
            }
        },
        [t],
    );

    useEffect(() => {
        setSelectedPostIds([]);
        void loadPosts(page);
    }, [loadPosts, page]);

    function togglePost(postId: string) {
        setSelectedPostIds((current) =>
            current.includes(postId)
                ? current.filter((id) => id !== postId)
                : [...current, postId],
        );
    }

    function toggleAllPosts() {
        setSelectedPostIds(allSelected ? [] : allPostIds);
    }

    function closeActionsMenu() {
        setActionsAnchor(null);
    }

    function openBatchEdit() {
        closeActionsMenu();
        setBatchVisibility("");
        setBatchStatus("");
        setBatchAllowDownload("");
        setBatchContentWarning("");
        setBatchClearContentWarning(false);
        setBatchTags("");
        setBatchEditOpen(true);
    }

    async function applyBatchEdit() {
        if (!selectedPostIds.length) return;
        const payload: Record<string, unknown> = { postIds: selectedPostIds };
        if (batchVisibility) payload.visibility = batchVisibility;
        if (batchStatus) payload.status = batchStatus;
        if (batchAllowDownload) payload.allowDownload = batchAllowDownload === "true";
        if (batchClearContentWarning) payload.contentWarning = null;
        else if (batchContentWarning.trim()) payload.contentWarning = batchContentWarning.trim();
        if (batchTags.trim())
            payload.tags = batchTags.split(",").map((value) => value.trim()).filter(Boolean);

        if (Object.keys(payload).length === 1) {
            setError("Choose at least one field to change.");
            return;
        }

        setBatchEditing(true);
        setError("");
        try {
            await api("/v1/posts/batch", {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            setSelectedPostIds([]);
            setBatchEditOpen(false);
            await loadPosts(page);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to batch edit selected posts.");
        } finally {
            setBatchEditing(false);
        }
    }

    async function deletePost(post: Post) {
        if (!window.confirm("Delete \"" + (post.title || post.id) + "\" permanently? This cannot be undone."))
            return;
        setError("");
        try {
            await api("/v1/posts/" + encodeURIComponent(post.id), { method: "DELETE" });
            setSelectedPostIds((current) => current.filter((id) => id !== post.id));
            const refreshed = await loadPosts(page);
            if (refreshed && page > 1 && refreshed.page > refreshed.totalPages)
                await loadPosts(Math.max(1, refreshed.totalPages));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to delete post.");
        }
    }

    async function copyPostUrl(post: Post) {
        try {
            await navigator.clipboard.writeText(postPublicUrl(post));
        } catch {
            setError("Unable to copy the post URL.");
        }
        closePostMenu();
    }

    async function openRevisions(post: Post) {
        closePostMenu();
        setRevisionsOpen(true);
        setRevisionsLoading(true);
        setRevisions([]);
        try {
            const response = await api<{ data: PostRevision[] }>(
                "/v1/posts/" + encodeURIComponent(post.id) + "/revisions",
            );
            setRevisions(response.data ?? []);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load post versions.");
            setRevisionsOpen(false);
        } finally {
            setRevisionsLoading(false);
        }
    }

    async function combineSelected() {
        if (!canCombineSelected) return;
        setMerging(true);
        setError("");
        try {
            const response = await api<{ data: Post }>("/v1/posts/merge", {
                method: "POST",
                body: JSON.stringify({ postIds: selectedDraftIds }),
            });
            setSelectedPostIds([]);
            setPosts((current) =>
                current
                    ? [response.data, ...current.filter((post) => !selectedDraftIds.includes(post.id))]
                    : current,
            );
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to combine selected posts.");
        } finally {
            setMerging(false);
        }
    }

    async function deleteSelected() {
        if (
            !selectedPostIds.length ||
            !window.confirm(
                `Delete ${selectedPostIds.length} selected posts permanently? This cannot be undone.`,
            )
        )
            return;

        setDeleting(true);
        setError("");
        try {
            await api<{ data: { deletedCount: number } }>("/v1/posts/batch", {
                method: "DELETE",
                body: JSON.stringify({ postIds: selectedPostIds }),
            });
            setPosts((current) =>
                current ? current.filter((post) => !selectedPostIds.includes(post.id)) : current,
            );
            setSelectedPostIds([]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to delete selected posts.");
        } finally {
            setDeleting(false);
        }
    }


    function openPostMenu(event: React.MouseEvent<HTMLElement>, post: Post) {
        event.preventDefault();
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setMenuPost(post);
    }

    function closePostMenu() {
        setMenuAnchor(null);
        setMenuPost(null);
    }

    function openConvertDialog() {
        if (!menuPost) return;
        setConvertSelection([menuPost.id]);
        setConvertOpen(true);
        closePostMenu();
    }

    async function convertToMultiPost() {
        if (convertSelection.length < 2) return;
        setMerging(true);
        setError("");
        try {
            const response = await api<{ data: Post }>("/v1/posts/merge", {
                method: "POST",
                body: JSON.stringify({ postIds: convertSelection }),
            });
            setConvertOpen(false);
            setConvertSelection([]);
            setPosts((current) =>
                current
                    ? [
                          response.data,
                          ...current.filter((post) => !convertSelection.includes(post.id)),
                      ]
                    : current,
            );
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to convert posts.");
        } finally {
            setMerging(false);
        }
    }

    async function splitPost(post: Post) {
        if (!post.uploads || post.uploads.length < 2) return;
        if (!window.confirm("Split this multi-image post into separate posts?")) return;
        setSplitBusy(true);
        setError("");
        try {
            const response = await api<{ data: Post[] }>(
                `/v1/posts/${encodeURIComponent(post.id)}/split`,
                { method: "POST" },
            );
            setPosts((current) =>
                current
                    ? [
                          ...response.data,
                          ...current.filter((currentPost) => currentPost.id !== post.id),
                      ]
                    : current,
            );
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to split post.");
        } finally {
            setSplitBusy(false);
            closePostMenu();
        }
    }

    return (
        <Page>
            <Stack spacing={{ xs: 2, sm: 3 }}>
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                >
                    <div>
                        <Typography variant="h4" component="h1">
                            {t("dashboardPosts.managePosts")}
                        </Typography>
                        {posts ? (
                            <Typography color="text.secondary">
                                {t("dashboardPosts.postCount", { count: total })}
                            </Typography>
                        ) : null}
                    </div>
                    <Button variant="contained" component="a" href="/posts/new/">
                        {t("dashboardPosts.newPost")}
                    </Button>
                </Stack>
                {error ? <Alert severity="error">{error}</Alert> : null}                {posts && posts.length > 0 ? (
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        justifyContent="space-between"
                        sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}
                    >
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={partiallySelected}
                                    onChange={toggleAllPosts}
                                    inputProps={{ "aria-label": "Select all posts" }}
                                />
                            }
                            label={selectedPostIds.length ? `${selectedPostIds.length} selected` : "Select all posts"}
                        />
                        <Button
                            variant="outlined"
                            endIcon={<ArrowDropDownIcon />}
                            onClick={(event) => setActionsAnchor(event.currentTarget)}
                            disabled={!selectedPostIds.length}
                            aria-haspopup="menu"
                            aria-expanded={Boolean(actionsAnchor) ? "true" : undefined}
                        >
                            Actions{selectedPostIds.length ? " (" + selectedPostIds.length + ")" : ""}
                        </Button>
                    </Stack>
                ) : null}

                {posts === null && !error ? (
                    <LoadingState label={t("dashboardPosts.loading")} />
                ) : null}
                {posts?.length === 0 ? (
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: "center", py: { xs: 3, sm: 4 } }}>
                            <Typography variant="h5" component="h2" gutterBottom>
                                {t("dashboardPosts.empty")}
                            </Typography>
                            <Button variant="contained" component="a" href="/posts/new/">
                                {t("dashboardPosts.createFirst")}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}
                {posts && posts.length > 0 ? (
                    <Stack spacing={{ xs: 3, sm: 4 }}>
                        {imagePosts.length ? (
                            <Stack spacing={1.5}>
                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: "stretch", sm: "center" }}
                                >
                                    <Typography variant="h5" component="h2">
                                        Posts
                                    </Typography>
                                </Stack>
                                <Stack
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "repeat(auto-fill, minmax(min(100%, 256px), 1fr))",
                                        gap: { xs: 1, sm: 2 },
                                    }}
                                >
                                    {imagePosts.map((post) => (
                                        <Card
                                            key={post.id}
                                            variant="outlined"
                                            sx={{ overflow: "hidden", height: "100%" }}
                                        >
                                            <Box sx={{ position: "relative" }}>
                                                <IconButton
                                                    aria-label={`Actions for ${post.title || post.id}`}
                                                    onClick={(event) => openPostMenu(event, post)}
                                                    sx={{
                                                        position: "absolute",
                                                        top: 8,
                                                        right: 8,
                                                        zIndex: 2,
                                                        bgcolor: "background.paper",
                                                    }}
                                                >
                                                    <MoreVertIcon />
                                                </IconButton>

                                            <Box sx={{ px: 1, pt: 1, display: "flex", alignItems: "center" }}>
                                                <Checkbox
                                                    checked={selectedPostIds.includes(post.id)}
                                                    onChange={() => togglePost(post.id)}
                                                    inputProps={{ "aria-label": `Select post ${post.title || post.id}` }}
                                                />
                                                {post.status === "draft" ? (
                                                    <Typography component="span" variant="caption" color="text.secondary">
                                                        Draft
                                                    </Typography>
                                                ) : null}
                                            </Box>
                                            <CardActionArea
                                                component="a"
                                                href={`/dashboard/posts/${encodeURIComponent(post.id)}/`}
                                            >
                                                {post.uploads?.[0] ? (
                                                    <CardMedia
                                                        component="img"
                                                        image={imageUrl(post.uploads[0].url)}
                                                        alt={
                                                            post.uploads[0].alt || post.title || ""
                                                        }
                                                        loading="lazy"
                                                        sx={{
                                                            aspectRatio: "1 / 1",
                                                            objectFit: "cover",
                                                        }}
                                                    />
                                                ) : null}
                                                <CardContent>
                                                    <Typography variant="subtitle1" noWrap>
                                                        {post.title || t("common.untitled")}
                                                        {" · "}
                                                        {post.author?.name ||
                                                            post.author?.username ||
                                                            post.authorName ||
                                                            t("common.unknownAuthor")}
                                                    </Typography>
                                                    <Stack
                                                        direction="row"
                                                        spacing={0.75}
                                                        alignItems="center"
                                                        color="text.secondary"
                                                        sx={{ minWidth: 0 }}
                                                    >
                                                        <Typography variant="body2" noWrap>
                                                            {post.createdAt
                                                                ? new Date(
                                                                      post.createdAt,
                                                                  ).toLocaleDateString()
                                                                : ""}
                                                        </Typography>
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            aria-hidden="true"
                                                        >
                                                            ·
                                                        </Typography>
                                                        <Tooltip title="Views">
                                                            <Stack
                                                                direction="row"
                                                                spacing={0.25}
                                                                alignItems="center"
                                                            >
                                                                <VisibilityOutlinedIcon
                                                                    sx={{ fontSize: 15 }}
                                                                />
                                                                <Typography
                                                                    component="span"
                                                                    variant="caption"
                                                                >
                                                                    {post.viewCount ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip title="Likes">
                                                            <Stack
                                                                direction="row"
                                                                spacing={0.25}
                                                                alignItems="center"
                                                            >
                                                                <ThumbUpAltOutlinedIcon
                                                                    sx={{ fontSize: 15 }}
                                                                />
                                                                <Typography
                                                                    component="span"
                                                                    variant="caption"
                                                                >
                                                                    {post.reactions?.like ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip title="Favorites">
                                                            <Stack
                                                                direction="row"
                                                                spacing={0.25}
                                                                alignItems="center"
                                                            >
                                                                <FavoriteBorderIcon
                                                                    sx={{ fontSize: 15 }}
                                                                />
                                                                <Typography
                                                                    component="span"
                                                                    variant="caption"
                                                                >
                                                                    {post.reactions?.favorite ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip title="Saves">
                                                            <Stack
                                                                direction="row"
                                                                spacing={0.25}
                                                                alignItems="center"
                                                            >
                                                                <BookmarkBorderIcon
                                                                    sx={{ fontSize: 15 }}
                                                                />
                                                                <Typography
                                                                    component="span"
                                                                    variant="caption"
                                                                >
                                                                    {post.reactions?.save ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                    </Stack>
                                                </CardContent>
                                            </CardActionArea>
                                            </Box>
                                        </Card>
                                    ))}
                                </Stack>
                            </Stack>
                        ) : null}
                        {texts.length ? (
                            <Stack spacing={1.5}>
                                <Typography variant="h5" component="h2">
                                    Texts
                                </Typography>
                                <TextList
                                    texts={texts}
                                    hrefForText={(text) =>
                                        `/dashboard/posts/${encodeURIComponent(text.id)}/`
                                    }
                                    selectable
                                    selectedIds={selectedPostIds}
                                    onToggle={togglePost}
                                />
                            </Stack>
                        ) : null}
                    </Stack>
                ) : null}
                {total > 100 ? (
                    <Stack spacing={1} alignItems="center" sx={{ pt: 1 }}>
                        <Pagination
                            count={Math.ceil(total / 100)}
                            page={page}
                            onChange={(_, value) => setPage(value)}
                            showFirstButton
                            showLastButton
                        />
                        <Typography variant="body2" color="text.secondary">
                            Showing {(page - 1) * 100 + 1}–{Math.min(page * 100, total)} of {total} posts
                        </Typography>
                    </Stack>
                ) : null}
            </Stack>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closePostMenu}>
            <MenuItem
                onClick={() => {
                    if (menuPost) void deletePost(menuPost);
                    closePostMenu();
                }}
            >
                <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
                Delete
            </MenuItem>
            <MenuItem
                onClick={() => {
                    if (menuPost)
                        window.location.href =
                            "/dashboard/posts/" + encodeURIComponent(menuPost.id) + "/edit/";
                    closePostMenu();
                }}
            >
                <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                Edit
            </MenuItem>
            <MenuItem
                onClick={() => {
                    if (menuPost) window.location.href = postPublicUrl(menuPost);
                    closePostMenu();
                }}
            >
                <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                View
            </MenuItem>
            {menuPost?.uploads?.[0] ? (
                <MenuItem
                    component="a"
                    href={postOriginalUrl(menuPost) ?? undefined}
                    onClick={closePostMenu}
                >
                    <DownloadOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                    Download Original
                </MenuItem>
            ) : null}
            <MenuItem onClick={() => { if (menuPost) void copyPostUrl(menuPost); }}>
                <ContentCopyOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                Copy URL
            </MenuItem>
            <MenuItem onClick={() => { if (menuPost) void openRevisions(menuPost); }}>
                <HistoryOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                Version History
            </MenuItem>
            {menuPost?.status === "draft" ? (
                <MenuItem onClick={openConvertDialog} disabled={drafts.length < 2}>
                    Convert to multi-post
                </MenuItem>
            ) : null}
            {menuPost?.uploads && menuPost.uploads.length > 1 ? (
                <MenuItem onClick={() => void splitPost(menuPost)} disabled={splitBusy}>
                    {splitBusy ? "Splitting…" : "Split to single posts"}
                </MenuItem>
            ) : null}
        </Menu>
        <Menu
            anchorEl={actionsAnchor}
            open={Boolean(actionsAnchor)}
            onClose={closeActionsMenu}
        >
            <MenuItem
                disabled={!selectedPostIds.length || deleting}
                onClick={() => {
                    closeActionsMenu();
                    void deleteSelected();
                }}
            >
                <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
                Batch Delete
            </MenuItem>
            <MenuItem disabled={!selectedPostIds.length || batchEditing} onClick={openBatchEdit}>
                <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                Batch Edit
            </MenuItem>
            <MenuItem
                disabled={!canCombineSelected || merging}
                onClick={() => {
                    closeActionsMenu();
                    void combineSelected();
                }}
            >
                Combine selected
            </MenuItem>
        </Menu>
        <Dialog
            open={batchEditOpen}
            onClose={() => (batchEditing ? null : setBatchEditOpen(false))}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle>Batch Edit</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Changes apply to {selectedPostIds.length} selected posts. Leave fields unchanged to keep their current values.
                    </Typography>
                    <TextField
                        select
                        label="Visibility"
                        value={batchVisibility}
                        onChange={(event) => setBatchVisibility(event.target.value)}
                        fullWidth
                    >
                        <MenuItem value="">No change</MenuItem>
                        <MenuItem value="public">Public</MenuItem>
                        <MenuItem value="unlisted">Unlisted</MenuItem>
                        <MenuItem value="private">Private</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Status"
                        value={batchStatus}
                        onChange={(event) => setBatchStatus(event.target.value)}
                        fullWidth
                    >
                        <MenuItem value="">No change</MenuItem>
                        <MenuItem value="draft">Draft</MenuItem>
                        <MenuItem value="published">Published</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Downloads"
                        value={batchAllowDownload}
                        onChange={(event) => setBatchAllowDownload(event.target.value)}
                        fullWidth
                    >
                        <MenuItem value="">No change</MenuItem>
                        <MenuItem value="true">Allow downloads</MenuItem>
                        <MenuItem value="false">Disable downloads</MenuItem>
                    </TextField>
                    <TextField
                        label="Content warning"
                        value={batchContentWarning}
                        onChange={(event) => setBatchContentWarning(event.target.value)}
                        placeholder="Leave blank to keep the current warning"
                        fullWidth
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={batchClearContentWarning}
                                onChange={(event) =>
                                    setBatchClearContentWarning(event.target.checked)
                                }
                            />
                        }
                        label="Clear content warnings"
                    />
                    <TextField
                        label="Tags"
                        value={batchTags}
                        onChange={(event) => setBatchTags(event.target.value)}
                        helperText="Comma-separated replacement tag list. Leave blank to keep current tags."
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setBatchEditOpen(false)} disabled={batchEditing}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void applyBatchEdit()}
                    disabled={batchEditing || !selectedPostIds.length}
                >
                    {batchEditing ? "Applying…" : "Apply changes"}
                </Button>
            </DialogActions>
        </Dialog>
        <Dialog open={revisionsOpen} onClose={() => setRevisionsOpen(false)} fullWidth maxWidth="md">
            <DialogTitle>Version History</DialogTitle>
            <DialogContent>
                {revisionsLoading ? (
                    <LoadingState label="Loading versions…" />
                ) : revisions.length ? (
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        {revisions.map((revision, index) => (
                            <Card key={revision.id} variant="outlined">
                                <CardContent>
                                    <Stack spacing={0.5}>
                                        <Typography variant="subtitle1">
                                            Version {revisions.length - index}: {revision.title || "Untitled"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {new Date(revision.createdAt).toLocaleString()}
                                        </Typography>
                                        {revision.description ? (
                                            <Typography variant="body2">{revision.description}</Typography>
                                        ) : null}
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                ) : (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                        No saved versions yet.
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setRevisionsOpen(false)}>Close</Button>
            </DialogActions>
        </Dialog>
        <Dialog open={convertOpen} onClose={() => setConvertOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Convert to multi-post</DialogTitle>
            <DialogContent>
                <Stack spacing={0.5}>
                    {drafts.map((draft) => (
                        <FormControlLabel
                            key={draft.id}
                            control={
                                <Checkbox
                                    checked={convertSelection.includes(draft.id)}
                                    onChange={() =>
                                        setConvertSelection((current) =>
                                            current.includes(draft.id)
                                                ? current.filter((id) => id !== draft.id)
                                                : [...current, draft.id],
                                        )
                                    }
                                />
                            }
                            label={draft.title || t("common.untitled")}
                        />
                    ))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConvertOpen(false)}>Cancel</Button>
                <Button
                    variant="contained"
                    disabled={convertSelection.length < 2 || merging}
                    onClick={() => void convertToMultiPost()}
                >
                    {merging ? "Converting…" : "Convert"}
                </Button>
            </DialogActions>
        </Dialog>
        </Page>
    );
}
const root = document.querySelector("#dashboard-posts-page");
if (root)
    createRoot(root).render(
        <App>
            <DashboardPostsPage />
        </App>,
    );
