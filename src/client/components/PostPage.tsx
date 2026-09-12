import { Alert, Avatar, Button, Card, CardContent, CardMedia, Chip, Container, Divider, Stack, TextField, Typography } from "@mui/material";
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

function authorName(post: Post) {
    return post.author?.name || post.author?.username || post.authorName || "Unknown author";
}

function CommentItem({ comment, currentUser, onUpdate }: { comment: Comment; currentUser: CurrentUser | null; onUpdate: () => Promise<void> }) {
    const [busy, setBusy] = useState(false);
    const ownComment = currentUser?.id === comment.author?.id;

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
        <Card variant="outlined">
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

    const load = useCallback(async () => {
        const response = await api<{ data: Comment[] }>(`/v1/posts/${encodeURIComponent(postId)}/comments?limit=100`);
        setComments(response.data || []);
    }, [postId]);

    useEffect(() => {
        let active = true;
        void Promise.all([
            load(),
            api<{ data: CurrentUser }>('/v1/me').then((response) => {
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
                    {comments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} currentUser={currentUser} onUpdate={load} />
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
            <Page>
                <Alert severity="error">{error}</Alert>
                <Button component="a" href="/posts/" sx={{ mt: 2 }}>Back to posts</Button>
            </Page>
        );

    if (!post)
        return <Page><Typography color="text.secondary">Loading post…</Typography></Page>;

    return (
        <Page>
            <Container maxWidth="lg" disableGutters>
                <Stack spacing={3}>
                    <Stack spacing={3}>
                        {post.uploads?.map((upload) => (
                            <Card key={upload.id} variant="outlined" sx={{ overflow: "hidden" }}>
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
                        ))}
                    </Stack>

                    <Divider />

                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack spacing={0.5}>
                                    <Typography variant="h3" component="h1">
                                        {post.title || "Untitled"}
                                    </Typography>
                                    <Typography color="text.secondary">
                                        {authorName(post)}
                                    </Typography>
                                </Stack>
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

                    <Card variant="outlined">
                        <CardContent>
                            <Comments postId={postId} />
                        </CardContent>
                    </Card>
                </Stack>
            </Container>
        </Page>
    );
}
