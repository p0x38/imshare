import { Alert, Avatar, Button, Card, CardContent, CardMedia, Chip, Divider, Fade, Grow, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import { useCallback, useEffect, useState } from "react";
import { Page } from "./Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Comment {
    id: string;
    body: string;
    createdAt: string;
    liked?: boolean;
    likes?: number;
    author?: {
        id: string;
        name?: string | null;
        username?: string | null;
    } | null;
}

interface CurrentUser {
    id: string;
}

function imageUrl(url: string, width = 1600) {
    const image = new URL(url, window.location.origin);
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
}

function authorUrl(post: Post) {
    return post.author?.id ? `/users/${encodeURIComponent(post.author.id)}/` : undefined;
}

function relativeTime(value: string) {
    const date = new Date(value);
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absoluteSeconds = Math.abs(seconds);
    const units = [
        [31536000, "year"],
        [2592000, "month"],
        [604800, "week"],
        [86400, "day"],
        [3600, "hour"],
        [60, "minute"],
    ] as const;
    for (const [unitSeconds, unit] of units) {
        if (absoluteSeconds >= unitSeconds)
            return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(seconds / unitSeconds), unit);
    }
    return "just now";
}

function absoluteTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date(value));
}

function useReducedMotion() {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    return reduced;
}

function PostActions({ postId }: { postId: string }) {
    const [busy, setBusy] = useState("");
    const reducedMotion = useReducedMotion();

    const toggle = async (kind: "like" | "favorite" | "save") => {
        if (busy) return;
        setBusy(kind);
        try {
            await api(`/v1/posts/${encodeURIComponent(postId)}/${kind}`, { method: "PUT" });
        } finally {
            setBusy("");
        }
    };

    const buttonSx = (borderLeft = false) => ({
        borderRadius: 0,
        ...(borderLeft ? { borderLeft: 1, borderColor: "divider" } : {}),
        transition: reducedMotion ? "none" : "transform 140ms ease, background-color 140ms ease",
        "&:hover": reducedMotion ? {} : { transform: "translateY(-1px)" },
        "&:active": reducedMotion ? {} : { transform: "scale(0.96)" },
    });

    return (
        <Stack direction="row" justifyContent="flex-end">
            <Stack direction="row" sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                <Tooltip title="Like">
                    <IconButton
                        aria-label="Like"
                        disabled={busy !== "" && busy !== "like"}
                        onClick={() => void toggle("like")}
                        sx={buttonSx()}
                    >
                        <ThumbUpAltOutlinedIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Favorite">
                    <IconButton
                        aria-label="Favorite"
                        disabled={busy !== "" && busy !== "favorite"}
                        onClick={() => void toggle("favorite")}
                        sx={buttonSx(true)}
                    >
                        <FavoriteBorderIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Save">
                    <IconButton
                        aria-label="Save"
                        disabled={busy !== "" && busy !== "save"}
                        onClick={() => void toggle("save")}
                        sx={buttonSx(true)}
                    >
                        <BookmarkBorderIcon />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Stack>
    );
}

function CommentItem({ comment, currentUser, onUpdate }: { comment: Comment; currentUser: CurrentUser | null; onUpdate: () => Promise<void> }) {
    const [busy, setBusy] = useState(false);
    const ownComment = currentUser?.id === comment.author?.id;
    const reducedMotion = useReducedMotion();

    const run = async (callback: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        try {
            await callback();
            await onUpdate();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card
            variant="outlined"
            sx={{
                transition: reducedMotion ? "none" : "transform 160ms ease, box-shadow 160ms ease",
                "&:hover": reducedMotion ? {} : { transform: "translateY(-2px)", boxShadow: 2 },
            }}
        >
            <CardContent>
                <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32 }}>
                            {(comment.author?.name || comment.author?.username || "?").charAt(0).toUpperCase()}
                        </Avatar>
                        <Stack>
                            <Typography variant="subtitle2">
                                {comment.author?.name || comment.author?.username || "Unknown author"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {new Date(comment.createdAt).toLocaleString()}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.body}</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            disabled={busy}
                            onClick={() => run(() => api(`/v1/comments/${encodeURIComponent(comment.id)}/like`, { method: comment.liked ? "DELETE" : "PUT" }))}
                        >
                            {comment.likes ? `Like ${comment.likes}` : "Like"}
                        </Button>
                        {ownComment ? (
                            <Button
                                size="small"
                                color="error"
                                disabled={busy}
                                onClick={() => {
                                    if (!window.confirm("Delete this comment?")) return;
                                    void run(() => api(`/v1/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" }));
                                }}
                            >
                                Delete
                            </Button>
                        ) : null}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function Comments({ postId }: { postId: string }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const reducedMotion = useReducedMotion();

    const load = useCallback(async () => {
        const response = await api<{ data: Comment[] }>(`/v1/posts/${encodeURIComponent(postId)}/comments?limit=100`);
        setComments(response.data || []);
    }, [postId]);

    useEffect(() => {
        let active = true;
        void Promise.all([
            load(),
            api<{ data: CurrentUser }>("/v1/me").then((response) => {
                if (active) setCurrentUser(response.data);
            }).catch(() => {}),
        ]).catch((cause) => {
            if (active) setError(cause instanceof Error ? cause.message : "Unable to load comments.");
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [load]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const value = body.trim();
        if (!value || submitting) return;
        setSubmitting(true);
        setError("");
        try {
            await api(`/v1/posts/${encodeURIComponent(postId)}/comments`, {
                method: "POST",
                body: JSON.stringify({ body: value }),
            });
            setBody("");
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to post comment.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Stack spacing={2}>
            <Typography variant="h5" component="h2">Comments</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {loading ? (
                <Typography color="text.secondary">Loading comments…</Typography>
            ) : comments.length ? (
                <Stack spacing={1.5}>
                    {comments.map((comment, index) => (
                        <Grow key={comment.id} in timeout={reducedMotion ? 0 : 220 + index * 35} style={{ transformOrigin: "top center" }}>
                            <div>
                                <CommentItem comment={comment} currentUser={currentUser} onUpdate={load} />
                            </div>
                        </Grow>
                    ))}
                </Stack>
            ) : (
                <Typography color="text.secondary">No comments yet.</Typography>
            )}
            <Stack component="form" spacing={1} onSubmit={submit}>
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Add a comment"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    inputProps={{ maxLength: 5000 }}
                />
                <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={submitting || !body.trim()}>
                        {submitting ? "Posting…" : "Post comment"}
                    </Button>
                </Stack>
            </Stack>
        </Stack>
    );
}

export function PostPage({ postId }: { postId: string }) {
    const [post, setPost] = useState<Post | null>(null);
    const [error, setError] = useState("");
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        let active = true;
        void api<{ data: Post }>(`/v1/posts/${encodeURIComponent(postId)}`)
            .then((response) => {
                if (!active) return;
                setPost(response.data);
                document.title = `${response.data.title || "Untitled"} · imshare`;
            })
            .catch((cause) => {
                if (active) setError(cause instanceof Error ? cause.message : "Unable to load post.");
            });
        return () => {
            active = false;
        };
    }, [postId]);

    if (error)
        return (
            <Page maxWidth="lg">
                <Fade in timeout={reducedMotion ? 0 : 180}>
                    <div>
                        <Alert severity="error">{error}</Alert>
                        <Button component="a" href="/posts/" sx={{ mt: 2 }}>Back to posts</Button>
                    </div>
                </Fade>
            </Page>
        );

    if (!post)
        return (
            <Page maxWidth="lg">
                <Fade in timeout={reducedMotion ? 0 : 180}>
                    <div><Typography color="text.secondary">Loading post…</Typography></div>
                </Fade>
            </Page>
        );

    const authorName = post.author?.name || post.authorName || post.author?.id || "Unknown author";
    const authorHref = authorUrl(post);
    const metadata = [
        authorHref ? (
            <Typography key="user" component="a" href={authorHref} color="text.secondary" sx={{ width: "fit-content" }}>
                {authorName}
            </Typography>
        ) : (
            <Typography key="user" component="span" color="text.secondary">
                {authorName}
            </Typography>
        ),
        <Typography key="views" component="span" color="text.secondary">
            {post.viewCount ?? 0} views
        </Typography>,
        ...(post.createdAt
            ? [
                  <Tooltip key="created" title={`Created ${absoluteTime(post.createdAt)}`}>
                      <Typography component="time" dateTime={post.createdAt} color="text.secondary" sx={{ cursor: "help" }}>
                          {relativeTime(post.createdAt)}
                      </Typography>
                  </Tooltip>,
              ]
            : []),
        ...(post.updatedAt && post.updatedAt !== post.createdAt
            ? [
                  <Tooltip key="updated" title={`Updated ${absoluteTime(post.updatedAt)}`}>
                      <Typography component="time" dateTime={post.updatedAt} color="text.secondary" sx={{ cursor: "help" }}>
                          updated {relativeTime(post.updatedAt)}
                      </Typography>
                  </Tooltip>,
              ]
            : []),
    ];

    const cardSx = {
        transition: reducedMotion ? "none" : "transform 180ms ease, box-shadow 180ms ease",
        "&:hover": reducedMotion ? {} : { transform: "translateY(-2px)", boxShadow: 2 },
    };

    return (
        <Page maxWidth="lg">
            <Stack spacing={{ xs: 2, sm: 3 }}>
                <Fade in timeout={reducedMotion ? 0 : 260}>
                    <div>
                        <Stack spacing={{ xs: 1, sm: 1.5 }}>
                            {post.uploads?.map((upload, index) => (
                                <Grow
                                    key={upload.id}
                                    in
                                    timeout={reducedMotion ? 0 : 220 + index * 45}
                                    style={{ transformOrigin: "center top" }}
                                >
                                    <div>
                                        <Card variant="outlined" sx={{ ...cardSx, overflow: "hidden" }}>
                                            <CardMedia
                                                component="img"
                                                image={imageUrl(upload.url)}
                                                alt={upload.alt || post.title || ""}
                                                sx={{ maxHeight: "80vh", objectFit: "contain" }}
                                            />
                                            {upload.alt ? (
                                                <CardContent>
                                                    <Typography color="text.secondary">{upload.alt}</Typography>
                                                </CardContent>
                                            ) : null}
                                        </Card>
                                    </div>
                                </Grow>
                            ))}
                        </Stack>
                    </div>
                </Fade>

                <Divider />

                <Fade in timeout={reducedMotion ? 0 : 320} style={{ transitionDelay: reducedMotion ? "0ms" : "80ms" }}>
                    <div>
                        <Card variant="outlined" sx={cardSx}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h3" component="h1">
                                            {post.title || "Untitled"}
                                        </Typography>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            useFlexGap
                                            flexWrap="wrap"
                                            divider={<Typography color="text.disabled">・</Typography>}
                                        >
                                            {metadata}
                                        </Stack>
                                    </Stack>
                                    <PostActions postId={post.id} />
                                    {post.description ? (
                                        <>
                                            <Divider />
                                            <Typography sx={{ whiteSpace: "pre-wrap" }}>{post.description}</Typography>
                                        </>
                                    ) : null}
                                    {post.tags?.length || post.categories?.length ? (
                                        <>
                                            <Divider />
                                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                                {post.tags?.map((tag) => {
                                                    const id = tag.id || tag.tag?.id;
                                                    const name = tag.name || tag.tag?.name;
                                                    return id && name ? (
                                                        <Chip key={`tag-${id}`} label={name} component="a" href={`/tags/${encodeURIComponent(id)}/`} clickable />
                                                    ) : null;
                                                })}
                                                {post.categories?.map((category) => {
                                                    const id = category.id || category.category?.id;
                                                    const name = category.name || category.category?.name;
                                                    return id && name ? (
                                                        <Chip key={`category-${id}`} label={name} component="a" href={`/categories/${encodeURIComponent(id)}/`} clickable />
                                                    ) : null;
                                                })}
                                            </Stack>
                                        </>
                                    ) : null}
                                </Stack>
                            </CardContent>
                        </Card>
                    </div>
                </Fade>

                <Fade in timeout={reducedMotion ? 0 : 320} style={{ transitionDelay: reducedMotion ? "0ms" : "140ms" }}>
                    <div>
                        <Card variant="outlined" sx={cardSx}>
                            <CardContent>
                                <Comments postId={postId} />
                            </CardContent>
                        </Card>
                    </div>
                </Fade>
            </Stack>
        </Page>
    );
}
