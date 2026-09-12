import { Card, CardContent, CardMedia, Typography } from "@mui/material";
import type { Post } from "../lib/types";

function imageUrl(url: string, width = 480) {
    const image = new URL(url, window.location.origin);
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
}

export function PostGrid({ posts }: { posts: Post[] }) {
    if (posts.length === 0)
        return (
            <Card variant="outlined">
                <CardContent sx={{ textAlign: "center" }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                        No posts found
                    </Typography>
                    <Typography color="text.secondary">
                        There are no posts matching this view yet.
                    </Typography>
                </CardContent>
            </Card>
        );

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
            }}
        >
            {posts.map((post) => (
                <Card key={post.id} variant="outlined" sx={{ overflow: "hidden" }}>
                    <a href={`/posts/${encodeURIComponent(post.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {post.uploads?.[0] ? (
                            <CardMedia
                                component="img"
                                image={imageUrl(post.uploads[0].url)}
                                alt={post.uploads[0].alt || post.title || ""}
                                loading="lazy"
                                sx={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                            />
                        ) : null}
                        <CardContent>
                            <Typography variant="subtitle1" noWrap>
                                {post.title || "Untitled"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                                {post.author?.name || post.author?.username || post.authorName || "Unknown author"}
                            </Typography>
                        </CardContent>
                    </a>
                </Card>
            ))}
        </div>
    );
}
