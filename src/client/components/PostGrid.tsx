import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    CardMedia,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import type { Post } from "../lib/types";
import { AnimatedItem } from "./Motion";

function imageUrl(url: string, width = 512) {
    const image = new URL(url, window.location.origin);
    if (image.pathname.startsWith("/v1/")) image.pathname = `/api${image.pathname}`;
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
}

export type PostGridDensity = "compact" | "comfortable" | "spacious";

const DENSITY_KEY = "imshare.postGridDensity";

const densitySettings: Record<
    PostGridDensity,
    { columns: number; gap: { xs: number; sm: number } }
> = {
    compact: { columns: 6, gap: { xs: 0.75, sm: 1.25 } },
    comfortable: { columns: 4, gap: { xs: 1, sm: 2 } },
    spacious: { columns: 3, gap: { xs: 1.5, sm: 2.5 } },
};

export function usePostGridDensity(storageKey = DENSITY_KEY): [
    PostGridDensity,
    (value: PostGridDensity) => void,
] {
    const [density, setDensity] = useState<PostGridDensity>(() => {
        const value = localStorage.getItem(storageKey);
        return value === "compact" || value === "spacious" ? value : "comfortable";
    });
    const changeDensity = (value: PostGridDensity) => {
        setDensity(value);
        localStorage.setItem(storageKey, value);
    };
    return [density, changeDensity];
}

export const postGridPostLimits: Record<PostGridDensity, number> = {
    compact: 36,
    comfortable: 16,
    spacious: 9,
};

function normalizePosts(value: Post[] | { posts?: Post[] }): Post[] {
    return Array.isArray(value) ? value : Array.isArray(value.posts) ? value.posts : [];
}

export function PostGrid({
    posts: input,
    density = "comfortable",
}: {
    posts: Post[] | { posts?: Post[] };
    density?: PostGridDensity;
}) {
    const { t } = useTranslation();
    const posts = normalizePosts(input).filter((post) => post.contentType !== "text");
    const { columns, gap } = densitySettings[density];

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
                gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(${Math.min(columns, 3)}, minmax(0, 1fr))`, md: `repeat(${columns}, minmax(0, 1fr))` },
                gap,
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
                                    <Typography
                                        variant="body2"
                                        noWrap
                                        sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                                    >
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
                </AnimatedItem>
            ))}
        </Box>
    );
}
