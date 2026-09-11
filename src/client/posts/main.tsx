import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
    AppBar,
    Avatar,
    Box,
    Card,
    CardContent,
    CardMedia,
    Chip,
    CircularProgress,
    Container,
    Divider,
    IconButton,
    Snackbar,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar,
    Tooltip,
    Typography,
    createTheme,
    ThemeProvider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";

interface Upload {
    id: string;
    url: string;
    originalName?: string;
}

interface Label {
    id: string;
    name: string;
}

interface Author {
    id: string;
    name: string;
    username?: string;
}

interface ReactionState {
    counts: Record<"like" | "favorite" | "save", number>;
    active: Record<"like" | "favorite" | "save", boolean>;
}

interface Post {
    id: string;
    title: string;
    description?: string | null;
    caption?: string | null;
    sourceUrl?: string | null;
    createdAt: string;
    allowDownload?: boolean;
    author: Author;
    uploads: Upload[];
    tags?: Label[];
    categories?: Label[];
    category?: Label | null;
    reactions?: ReactionState["counts"];
    viewer?: {
        liked?: boolean;
        favorited?: boolean;
        saved?: boolean;
    };
}

interface Recommendation {
    id: string;
    title: string;
    author?: Author;
    uploads?: Upload[];
}

interface ApiResponse<T> {
    data: T;
}

const theme = createTheme();

async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options?.body ? { "Content-Type": "application/json" } : {}),
            ...(options?.headers ?? {}),
        },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(body?.error?.message ?? `Request failed (${response.status}).`);
    }
    return body as T;
}

function imageUrl(upload: Upload, width = 1600) {
    return `${upload.url}?width=${width}&format=webp`;
}

function ReactionButton({
    value,
    label,
    count,
    selected,
    icon,
    selectedIcon,
    onChange,
}: {
    value: string;
    label: string;
    count: number;
    selected: boolean;
    icon: React.ReactNode;
    selectedIcon: React.ReactNode;
    onChange: () => void;
}) {
    return (
        <ToggleButton value={value} selected={selected} onChange={onChange} sx={{ flex: 1, minWidth: 0, gap: 0.75 }}>
            {selected ? selectedIcon : icon}
            <Typography variant="button" component="span" noWrap>
                {label}
                {count > 0 ? ` ${count}` : ""}
            </Typography>
        </ToggleButton>
    );
}

function PostActions({ post, onError }: { post: Post; onError: (message: string) => void }) {
    const [state, setState] = useState<ReactionState>({
        counts: {
            like: post.reactions?.like ?? 0,
            favorite: post.reactions?.favorite ?? 0,
            save: post.reactions?.save ?? 0,
        },
        active: {
            like: Boolean(post.viewer?.liked),
            favorite: Boolean(post.viewer?.favorited),
            save: Boolean(post.viewer?.saved),
        },
    });

    useEffect(() => {
        api<ApiResponse<ReactionState>>(`/v1/posts/${encodeURIComponent(post.id)}/reactions`)
            .then((result) => setState(result.data))
            .catch(() => undefined);
    }, [post.id]);

    const toggle = async (type: "like" | "favorite" | "save") => {
        const active = state.active[type];
        try {
            const result = await api<ApiResponse<ReactionState>>(
                `/v1/posts/${encodeURIComponent(post.id)}/${type}`,
                { method: active ? "DELETE" : "PUT" },
            );
            setState(result.data);
        } catch (error) {
            onError(error instanceof Error ? error.message : "Unable to update reaction.");
        }
    };

    return (
        <ToggleButtonGroup fullWidth sx={{ width: "100%" }}>
            <ReactionButton
                value="like"
                label="Like"
                count={state.counts.like}
                selected={state.active.like}
                onChange={() => void toggle("like")}
                icon={<ThumbUpAltOutlinedIcon />}
                selectedIcon={<ThumbUpAltIcon />}
            />
            <ReactionButton
                value="favorite"
                label="Favorite"
                count={state.counts.favorite}
                selected={state.active.favorite}
                onChange={() => void toggle("favorite")}
                icon={<FavoriteBorderIcon />}
                selectedIcon={<FavoriteIcon />}
            />
            <ReactionButton
                value="save"
                label="Save"
                count={state.counts.save}
                selected={state.active.save}
                onChange={() => void toggle("save")}
                icon={<BookmarkBorderIcon />}
                selectedIcon={<BookmarkIcon />}
            />
            <Tooltip title="More actions">
                <IconButton aria-label="More actions" sx={{ border: 1, borderColor: "divider", borderRadius: 0 }}>
                    <MoreVertIcon />
                </IconButton>
            </Tooltip>
        </ToggleButtonGroup>
    );
}

function LabelSection({ title, items, href }: { title: string; items: Label[]; href: (id: string) => string }) {
    if (!items.length) return null;
    return (
        <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
                {title}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {items.map((item) => (
                    <Chip
                        key={item.id}
                        label={item.name}
                        variant="outlined"
                        component="a"
                        href={href(item.id)}
                        clickable
                    />
                ))}
            </Stack>
        </Stack>
    );
}

function RecommendationSidebar({ posts }: { posts: Recommendation[] }) {
    if (!posts.length) return null;
    return (
        <Stack spacing={2} sx={{ position: "sticky", top: 16 }}>
            <Typography variant="h6" component="h2">
                Recommended
            </Typography>
            {posts.slice(0, 6).map((post) => {
                const image = post.uploads?.[0];
                return (
                    <Card key={post.id} variant="outlined" component="a" href={`/posts/${encodeURIComponent(post.id)}`} sx={{ textDecoration: "none" }}>
                        {image ? <CardMedia component="img" image={imageUrl(image, 480)} alt={post.title} sx={{ aspectRatio: "4 / 3", objectFit: "cover" }} /> : null}
                        <CardContent>
                            <Typography variant="subtitle1" component="h3">
                                {post.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {post.author?.name ?? "Unknown author"}
                            </Typography>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
}

function PostPage({ post, recommendations }: { post: Post; recommendations: Recommendation[] }) {
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const image = post.uploads[0];
    const authorName = post.author.name || post.author.username || "Unknown author";
    const categories = post.categories ?? (post.category ? [post.category] : []);

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
            <AppBar position="static" elevation={0}>
                <Toolbar>
                    <IconButton color="inherit" component="a" href="/" aria-label="Navigation">
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flex: 1 }}>
                        imshare
                    </Typography>
                    <IconButton color="inherit" component="a" href={`/users/${encodeURIComponent(post.author.id)}`} aria-label="Profile">
                        <Avatar sx={{ width: 32, height: 32 }}>{authorName.charAt(0).toUpperCase()}</Avatar>
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="xl" sx={{ py: { xs: 1, md: 3 } }}>
                <Box sx={{ display: { xs: "block", md: "grid" }, gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 3 }}>
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            {image ? (
                                <CardMedia
                                    component="img"
                                    image={imageUrl(image)}
                                    alt={post.caption || post.title || image.originalName || "Image"}
                                    sx={{ width: "100%", maxHeight: { xs: "70vh", md: "80vh" }, objectFit: "contain" }}
                                />
                            ) : null}
                            {post.caption ? (
                                <CardContent>
                                    <Typography variant="body1">{post.caption}</Typography>
                                </CardContent>
                            ) : null}
                        </Card>

                        <Stack spacing={2}>
                            <Typography variant="h5" component="h1">
                                {post.title}
                            </Typography>
                            <Typography variant="subtitle1" component="a" href={`/users/${encodeURIComponent(post.author.id)}`} color="text.secondary" sx={{ textDecoration: "none", width: "fit-content" }}>
                                by {authorName}
                            </Typography>
                            <PostActions post={post} onError={setSnackbar} />
                            <Divider />
                            <LabelSection title="Tags" items={post.tags ?? []} href={(id) => `/tags/${encodeURIComponent(id)}`} />
                            <LabelSection title="Categories" items={categories} href={(id) => `/categories/${encodeURIComponent(id)}`} />
                            {post.description ? <Typography variant="body1">{post.description}</Typography> : null}
                            {post.sourceUrl ? (
                                <Typography variant="body2">
                                    Source: <Box component="a" href={post.sourceUrl} target="_blank" rel="noopener noreferrer">{post.sourceUrl}</Box>
                                </Typography>
                            ) : null}
                        </Stack>
                    </Stack>

                    <Box sx={{ display: { xs: "none", md: "block" } }}>
                        <RecommendationSidebar posts={recommendations} />
                    </Box>
                </Box>
            </Container>

            <Snackbar open={Boolean(snackbar)} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar} />
        </Box>
    );
}

function ErrorPage({ message }: { message: string }) {
    return (
        <Container sx={{ py: 8 }}>
            <Typography variant="h4" component="h1">Unable to load post</Typography>
            <Typography variant="body1" color="text.secondary">{message}</Typography>
        </Container>
    );
}

function LoadingPage() {
    return (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "100vh" }}>
            <CircularProgress />
        </Stack>
    );
}

async function loadPost() {
    const id = decodeURIComponent(location.pathname.replace(/^\/posts\//, "").replace(/\/$/, ""));
    const [postResult, recommendationResult] = await Promise.all([
        api<ApiResponse<Post>>(`/v1/posts/${encodeURIComponent(id)}`),
        api<ApiResponse<Recommendation[]>>("/v1/recommendations?limit=6").catch(() => ({ data: [] })),
    ]);
    return { post: postResult.data, recommendations: recommendationResult.data };
}

function App() {
    const [state, setState] = useState<{ loading: boolean; post?: Post; recommendations: Recommendation[]; error?: string }>({
        loading: true,
        recommendations: [],
    });

    useEffect(() => {
        loadPost()
            .then(({ post, recommendations }) => setState({ loading: false, post, recommendations }))
            .catch((error) => setState({ loading: false, recommendations: [], error: error instanceof Error ? error.message : "Post not found." }));
    }, []);

    if (state.loading) return <LoadingPage />;
    if (state.error || !state.post) return <ErrorPage message={state.error ?? "Post not found."} />;
    return <PostPage post={state.post} recommendations={state.recommendations} />;
}

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);
