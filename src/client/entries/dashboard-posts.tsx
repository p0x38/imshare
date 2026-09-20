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
} from "@mui/material";
import { useEffect, useState } from "react";
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
import { api } from "../lib/api";
import type { Post } from "../lib/types";
function imageUrl(url: string, width = 512): string {
    const image = new URL(url, window.location.origin);
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
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
    const [convertSelection, setConvertSelection] = useState<string[]>([]);
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
    useEffect(() => {
        void api<{ data?: Post[] }>("/v1/me/posts?limit=100")
            .then((response) => setPosts(response.data ?? []))
            .catch((cause) => {
                const status = (cause as Error & { status?: number }).status;
                if (status === 401) {
                    window.location.href = "/account/login/";
                    return;
                }
                setError(cause instanceof Error ? cause.message : t("dashboardPosts.loadError"));
            });
    }, [t]);

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
                                {t("dashboardPosts.postCount", { count: posts.length })}
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
                        {selectedPostIds.length ? (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                    color="error"
                                    variant="outlined"
                                    disabled={deleting}
                                    onClick={() => void deleteSelected()}
                                >
                                    {deleting ? "Deleting…" : `Delete selected (${selectedPostIds.length})`}
                                </Button>
                                <Button
                                    variant="outlined"
                                    disabled={!canCombineSelected || merging}
                                    onClick={() => void combineSelected()}
                                >
                                    {merging ? "Combining…" : `Combine selected (${selectedDraftIds.length})`}
                                </Button>
                            </Stack>
                        ) : null}
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
                                    {drafts.length > 1 ? (
                                        <Button
                                            variant="outlined"
                                            disabled={!canCombineSelected || merging}
                                            onClick={() => void combineSelected()}
                                        >
                                            {merging ? "Combining…" : `Combine selected (${selectedDraftIds.length})`}
                                        </Button>
                                    ) : null}
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
            </Stack>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closePostMenu}>
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
            <MenuItem
                onClick={() => {
                    if (menuPost)
                        window.location.href = `/dashboard/posts/${encodeURIComponent(menuPost.id)}/`;
                    closePostMenu();
                }}
            >
                Open
            </MenuItem>
        </Menu>
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
