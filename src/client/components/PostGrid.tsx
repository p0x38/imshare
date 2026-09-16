import { Box, Card, CardActionArea, CardContent, CardMedia, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Post } from "../lib/types";
import { AnimatedItem } from "./Motion";

function imageUrl(url: string, width = 512) {
    const image = new URL(url, window.location.origin);
    if (image.pathname.startsWith("/v1/")) image.pathname = `/api${image.pathname}`;
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
}

function normalizePosts(value: Post[] | { posts?: Post[] }): Post[] {
    return Array.isArray(value) ? value : Array.isArray(value.posts) ? value.posts : [];
}

export function PostGrid({ posts: input }: { posts: Post[] | { posts?: Post[] } }) {
    const { t } = useTranslation();
    const posts = normalizePosts(input);

    if (posts.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent
                    sx={{ textAlign: "center", px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 } }}
                >
                    <Typography variant="h5" component="h2" gutterBottom>
                        {t("postGrid.noPosts")}
                    </Typography>
                    <Typography color="text.secondary">
                        {t("postGrid.noPostsDescription")}
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 256px), 1fr))",
                gap: { xs: 1, sm: 2 },
            }}
        >
            {posts.map((post, index) => (
                <AnimatedItem key={post.id} delay={Math.min(index, 10) * 35}>
                    <Card
                        variant="outlined"
                        sx={{
                            overflow: "hidden",
                            height: "100%",
                            transition: (theme) =>
                                theme.transitions.create(["transform", "box-shadow"], {
                                    duration: 220,
                                }),
                            "@media (hover: hover)": {
                                "&:has(.MuiCardActionArea-root:hover)": {
                                    transform: "translateY(-3px)",
                                    boxShadow: 3,
                                },
                            },
                            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                        }}
                    >
                        <CardActionArea
                            component="a"
                            href={`/posts/${encodeURIComponent(post.id)}`}
                            sx={{ display: "block", textAlign: "left", height: "100%" }}
                        >
                            {post.uploads?.[0] ? (
                                <CardMedia
                                    component="img"
                                    image={imageUrl(post.uploads[0].url)}
                                    alt={post.uploads[0].alt || post.title || ""}
                                    loading="lazy"
                                    sx={{
                                        aspectRatio: "1 / 1",
                                        objectFit: "cover",
                                        transition: (theme) =>
                                            theme.transitions.create("transform", {
                                                duration: 320,
                                            }),
                                        "@media (hover: hover)": {
                                            ".MuiCardActionArea-root:hover &": {
                                                transform: "scale(1.025)",
                                            },
                                        },
                                        "@media (prefers-reduced-motion: reduce)": {
                                            transition: "none",
                                        },
                                    }}
                                />
                            ) : null}
                            <CardContent
                                sx={{
                                    p: { xs: 1.25, sm: 2 },
                                    "&:last-child": { pb: { xs: 1.25, sm: 2 } },
                                }}
                            >
                                <Typography
                                    variant="subtitle1"
                                    noWrap
                                    sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}
                                >
                                    {post.title || t("common.untitled")}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
                                    sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                                >
                                    {post.author?.name ||
                                        post.author?.username ||
                                        post.authorName ||
                                        t("common.unknownAuthor")}
                                </Typography>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                </AnimatedItem>
            ))}
        </Box>
    );
}
