import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
    AppBar,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CardMedia,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    Divider,
    IconButton,
    Snackbar,
    Stack,
    TextField,
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
    avatarUrl?: string;
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

interface Comment {
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    author: Author;
    likes: number;
    liked: boolean;
}

interface Recommendation {
    id: string;
    title: string;
    author?: Author;
    uploads?: Upload[];
}

interface CollectionResponse<T> {
    data: T[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface ApiResponse<T> {
    data: T;
}

const theme = createTheme({
    palette: {
        mode: "dark",
    },
});

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
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
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

function CommentCard({ comment, onLike, onError }: { comment: Comment; onLike: (comment: Comment) => void; onError: (message: string) => void }) {
    const toggleLike = async () => {
        try {
            const result = await api<ApiResponse<Comment>>(`/v1/comments/${encodeURIComponent(comment.id)}/like`, {
                method: comment.liked ? "DELETE" : "PUT",
            });
            onLike(result.data);
        } catch (error) {
            onError(error instanceof Error ? error.message : "Unable to update comment like.");
        }
    };

    const authorName = comment.author.name || comment.author.username || "Unknown user";

    return (
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Avatar src={comment.author.avatarUrl} sx={{ width: 36, height: 36 }}>
                {authorName.charAt(0).toUpperCase()}
            </Avatar>
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" component="a" href={`/users/${encodeURIComponent(comment.author.id)}`} sx={{ textDecoration: "none", width: "fit-content" }}>
                    {authorName}
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {comment.body}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <IconButton size="small" aria-label={comment.liked ? "Unlike comment" : "Like comment"} onClick={() => void toggleLike()}>
                        {comment.liked ? <ThumbUpAltIcon fontSize="small" /> : <ThumbUpAltOutlinedIcon fontSize="small" />}
                    </IconButton>
                    {comment.likes > 0 ? <Typography variant="caption" color="text.secondary">{comment.likes}</Typography> : null}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {new Date(comment.createdAt).toLocaleString()}
                    </Typography>
                </Stack>
            </Stack>
        </Stack>
    );
}

function CommentSection({ postId, onError }: { postId: string; onError: (message: string) => void }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [total, setTotal] = useState(0);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const loadComments = async () => {
        try {
            const result = await api<CollectionResponse<Comment>>(`/v1/posts/${encodeURIComponent(postId)}/comments?limit=100`);
            setComments(result.data);
            setTotal(result.pagination?.total ?? result.data.length);
        } catch (error) {
            onError(error instanceof Error ? error.message : "Unable to load comments.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadComments();
    }, [postId]);

    const submit = async () => {
        const text = body.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        try {
            const result = await api<ApiResponse<Comment>>(`/v1/posts/${encodeURIComponent(postId)}/comments`, {
                method: "POST",
                body: JSON.stringify({ body: text }),
            });
            setComments((current) => [...current, result.data]);
            setTotal((current) => current + 1);
            setBody("");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to post comment.";
            if (message === "Authentication is required.") {
                onError("Please sign in to comment.");
            } else {
                onError(message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const replaceComment = (updated: Comment) => {
        setComments((current) => current.map((comment) => (comment.id === updated.id ? updated : comment)));
    };

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6" component="h2">
                        Comments {total > 0 ? `(${total})` : ""}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "flex-start" }}>
                        <TextField
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            onKeyDown={(event) => {
                                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void submit();
                            }}
                            label="Write a comment"
                            placeholder="Share your thoughts…"
                            multiline
                            minRows={2}
                            maxRows={8}
                            fullWidth
                            slotProps={{ htmlInput: { maxLength: 5000 } }}
                        />
                        <Button variant="contained" onClick={() => void submit()} disabled={!body.trim() || submitting} sx={{ minWidth: { sm: 112 }, minHeight: { sm: 56 } }}>
                            {submitting ? "Posting…" : "Post"}
                        </Button>
                    </Stack>
                    <Divider />
                    {loading ? (
                        <Stack alignItems="center" py={3}>
                            <CircularProgress size={24} />
                        </Stack>
                    ) : comments.length ? (
                        <Stack spacing={2}>
                            {comments.map((comment) => (
                                <CommentCard key={comment.id} comment={comment} onLike={replaceComment} onError={onError} />
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            No comments yet. Be the first to comment.
                        </Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

function RecommendationSection({ posts }: { posts: Recommendation[] }) {
    if (!posts.length) return null;
    return (
        <Stack spacing={2} sx={{ position: { md: "sticky" }, top: { md: 16 } }}>
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
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: "1036px",
                        mx: "auto",
                        display: { xs: "flex", md: "grid" },
                        flexDirection: "column",
                        gridTemplateColumns: { md: "minmax(0, 700px) 300px" },
                        gap: 3,
                        alignItems: "start",
                    }}
                >
                    <Stack spacing={2} sx={{ minWidth: 0, width: "100%", gridColumn: { md: "1" } }}>
                        <Card variant="outlined">
                            <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                {image ? (
                                    <CardMedia
                                        component="img"
                                        image={imageUrl(image)}
                                        alt={post.caption || post.title || image.originalName || "Image"}
                                        sx={{ width: "100%", maxWidth: 500, maxHeight: { xs: "70vh", md: "80vh" }, objectFit: "contain" }}
                                    />
                                ) : null}
                            </Box>
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

                        <CommentSection postId={post.id} onError={setSnackbar} />
                    </Stack>

                    <Box sx={{ gridColumn: { md: "2" }, display: { xs: "none", md: "block" }, width: "100%" }}>
                        <RecommendationSection posts={recommendations} />
                    </Box>

                    <Box sx={{ display: { xs: "block", md: "none" }, width: "100%" }}>
                        <RecommendationSection posts={recommendations} />
                    </Box>
                </Box>
            </Container>

            <Snackbar open={Boolean(snackbar)} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar} />
        </Box>
    );
}

function ErrorPage({ message }: { message: string }) {
    return (
        <Container maxWidth="lg" sx={{ py: 8, mx: "auto" }}>
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
        api<CollectionResponse<Recommendation>>(`/v1/posts/${encodeURIComponent(id)}/related?limit=6`).catch(() => ({ data: [] })),
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
            <CssBaseline />
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);
