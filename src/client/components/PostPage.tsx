import { Alert, Button, Card, CardContent, CardMedia, Chip, Container, Divider, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Page } from "./Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function imageUrl(url: string, width = 1200) {
    const image = new URL(url, window.location.origin);
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
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
        return () => { active = false; };
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
                    <Stack spacing={1}>
                        <Typography variant="h3" component="h1">{post.title || "Untitled"}</Typography>
                        <Typography color="text.secondary">
                            {post.author?.name || post.author?.username || post.authorName || "Unknown author"}
                        </Typography>
                    </Stack>
                    {post.uploads?.map((upload) => (
                        <Card key={upload.id} variant="outlined">
                            <CardMedia
                                component="img"
                                image={imageUrl(upload.url)}
                                alt={upload.alt || post.title || ""}
                                sx={{ maxHeight: "80vh", objectFit: "contain" }}
                            />
                        </Card>
                    ))}
                    {post.description ? (
                        <Card variant="outlined">
                            <CardContent>
                                <Typography sx={{ whiteSpace: "pre-wrap" }}>{post.description}</Typography>
                            </CardContent>
                        </Card>
                    ) : null}
                    {post.tags?.length || post.categories?.length ? (
                        <>
                            <Divider />
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {post.tags?.map((tag) => tag.id ? <Chip key={tag.id} label={tag.name} component="a" href={`/tags/${encodeURIComponent(tag.id)}/`} clickable /> : null)}
                                {post.categories?.map((category) => category.id ? <Chip key={category.id} label={category.name} component="a" href={`/categories/${encodeURIComponent(category.id)}/`} clickable /> : null)}
                            </Stack>
                        </>
                    ) : null}
                </Stack>
            </Container>
        </Page>
    );
}
