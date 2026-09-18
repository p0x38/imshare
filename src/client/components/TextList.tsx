import {
    Avatar,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import { useEffect, useState } from "react";
import type { Post } from "../lib/types";
import { api } from "../lib/api";

function TextCard({
    text,
    hrefForText,
}: {
    text: Post;
    hrefForText: (text: Post) => string;
}) {
    const author = text.author?.name || text.authorName || "Unknown user";
    const handle = text.author?.handle ? `@${text.author.handle}` : "";
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(text.reactions?.like ?? 0);
    const [busy, setBusy] = useState<"like" | "share" | "reply" | "">("");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        void api<{ data: { counts: { like: number }; active: { like: boolean } } }>(
            `/v1/posts/${encodeURIComponent(text.id)}/reactions`,
        )
            .then(({ data }) => {
                if (!active) return;
                setLikeCount(data.counts.like);
                setLiked(data.active.like);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [text.id]);

    const toggleLike = async () => {
        if (busy) return;
        setBusy("like");
        setError("");
        try {
            const response = await api<{
                data: { counts: { like: number }; active: { like: boolean } };
            }>(`/v1/posts/${encodeURIComponent(text.id)}/like`, {
                method: liked ? "DELETE" : "PUT",
            });
            setLikeCount(response.data.counts.like);
            setLiked(response.data.active.like);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to update like.");
        } finally {
            setBusy("");
        }
    };

    const share = async () => {
        if (busy) return;
        setBusy("share");
        setError("");
        const url = new URL(hrefForText(text), window.location.origin).href;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: text.title || "imshare text",
                    text: text.textContent || "",
                    url,
                });
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const input = document.createElement("textarea");
                input.value = url;
                input.style.position = "fixed";
                input.style.opacity = "0";
                document.body.appendChild(input);
                input.select();
                document.execCommand("copy");
                input.remove();
            }
        } catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError") return;
            setError(cause instanceof Error ? cause.message : "Unable to share this text.");
        } finally {
            setBusy("");
        }
    };

    const authorHref = text.author?.id
        ? text.author.handle
            ? `/users/@${encodeURIComponent(text.author.handle)}`
            : `/users/${encodeURIComponent(text.author.id)}/`
        : undefined;

    return (
        <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{ p: { xs: 1.25, sm: 1.5 }, border: 1, borderColor: "divider", borderRadius: 1 }}
        >
            <Avatar
                component={authorHref ? "a" : "div"}
                href={authorHref}
                src={text.author?.avatarUrl || text.author?.image || undefined}
                sx={{ width: 40, height: 40 }}
            >
                {author[0]?.toUpperCase()}
            </Avatar>
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                    <Typography fontWeight={700}>{author}</Typography>
                    {handle ? <Typography color="text.secondary">{handle}</Typography> : null}
                    <Typography color="text.secondary" variant="body2">
                        · {text.createdAt ? new Date(text.createdAt).toLocaleString() : ""}
                    </Typography>
                </Stack>
                <Typography
                    component="a"
                    href={hrefForText(text)}
                    sx={{
                        color: "inherit",
                        textDecoration: "none",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        display: "block",
                    }}
                >
                    {text.textContent}
                </Typography>
                {error ? (
                    <Typography variant="caption" color="error">
                        {error}
                    </Typography>
                ) : null}
                <Stack direction="row" spacing={0.5} sx={{ ml: -1 }}>
                    <IconButton
                        size="small"
                        aria-label="Reply"
                        disabled={Boolean(busy)}
                        onClick={() => window.location.assign(hrefForText(text))}
                    >
                        <ChatBubbleOutlineIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        aria-label="Share"
                        disabled={Boolean(busy)}
                        onClick={() => void share()}
                    >
                        <ShareOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        aria-label={liked ? "Unlike" : "Like"}
                        aria-pressed={liked}
                        disabled={Boolean(busy)}
                        onClick={() => void toggleLike()}
                        color={liked ? "error" : "default"}
                    >
                        <FavoriteBorderIcon fontSize="small" />
                        {likeCount > 0 ? (
                            <Typography component="span" sx={{ ml: 0.5, fontSize: "0.75rem" }}>
                                {likeCount}
                            </Typography>
                        ) : null}
                    </IconButton>
                </Stack>
            </Stack>
        </Stack>
    );
}

export function TextList({
    texts,
    hrefForText = (text) => `/texts/${encodeURIComponent(text.id)}/`,
}: {
    texts: Post[];
    hrefForText?: (text: Post) => string;
}) {
    const visibleTexts = texts.filter((text) => text.contentType === "text");
    if (!visibleTexts.length) return null;
    return (
        <Stack spacing={1.25}>
            {visibleTexts.map((text) => (
                <TextCard key={text.id} text={text} hrefForText={hrefForText} />
            ))}
        </Stack>
    );
}
