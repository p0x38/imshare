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
    const imagePosts = posts?.filter((post) => post.contentType !== "text") ?? [];
    const texts = posts?.filter((post) => post.contentType === "text") ?? [];
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
                {error ? <Alert severity="error">{error}</Alert> : null}
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
                                <Typography variant="h5" component="h2">Posts</Typography>
                                <Stack sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 256px), 1fr))", gap: { xs: 1, sm: 2 } }}>
                                    {imagePosts.map((post) => (
                                        <Card key={post.id} variant="outlined" sx={{ overflow: "hidden", height: "100%" }}>
                                            <CardActionArea component="a" href={`/dashboard/posts/${encodeURIComponent(post.id)}/`}>
                                                {post.uploads?.[0] ? <CardMedia component="img" image={imageUrl(post.uploads[0].url)} alt={post.uploads[0].alt || post.title || ""} loading="lazy" sx={{ aspectRatio: "1 / 1", objectFit: "cover" }} /> : null}
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
                                                                ? new Date(post.createdAt).toLocaleDateString()
                                                                : ""}
                                                        </Typography>
                                                        <Typography component="span" variant="body2" aria-hidden="true">
                                                            ·
                                                        </Typography>
                                                        <Tooltip title="Views">
                                                            <Stack direction="row" spacing={0.25} alignItems="center">
                                                                <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />
                                                                <Typography component="span" variant="caption">
                                                                    {post.viewCount ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip title="Likes">
                                                            <Stack direction="row" spacing={0.25} alignItems="center">
                                                                <ThumbUpAltOutlinedIcon sx={{ fontSize: 15 }} />
                                                                <Typography component="span" variant="caption">
                                                                    {post.reactions?.like ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip title="Favorites">
                                                            <Stack direction="row" spacing={0.25} alignItems="center">
                                                                <FavoriteBorderIcon sx={{ fontSize: 15 }} />
                                                                <Typography component="span" variant="caption">
                                                                    {post.reactions?.favorite ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip title="Saves">
                                                            <Stack direction="row" spacing={0.25} alignItems="center">
                                                                <BookmarkBorderIcon sx={{ fontSize: 15 }} />
                                                                <Typography component="span" variant="caption">
                                                                    {post.reactions?.save ?? 0}
                                                                </Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                    </Stack>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    ))}
                                </Stack>
                            </Stack>
                        ) : null}
                        {texts.length ? (
                            <Stack spacing={1.5}>
                                <Typography variant="h5" component="h2">Texts</Typography>
                                <TextList texts={texts} hrefForText={(text) => `/dashboard/posts/${encodeURIComponent(text.id)}/`} />
                            </Stack>
                        ) : null}
                    </Stack>
                ) : null}
            </Stack>
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
