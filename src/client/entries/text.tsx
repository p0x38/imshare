import { Alert, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function TextPage() {
    const textId = location.pathname.split("/").filter(Boolean).at(-1) || "";
    const [text, setText] = useState<Post | null>(null);
    const [error, setError] = useState("");
    const [reply, setReply] = useState("");
    const [replyError, setReplyError] = useState("");
    const [replying, setReplying] = useState(false);
    useEffect(() => {
        void api<{ data: Post }>(`/v1/texts/${encodeURIComponent(textId)}`)
            .then(({ data }) => {
                setText(data);
                document.title = `${data.title || "Untitled"} · imshare`;
            })
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : "Unable to load text."),
            );
    }, [textId]);
    if (error)
        return (
            <Page maxWidth="md">
                <Alert severity="error">{error}</Alert>
                <Button component="a" href="/texts/" sx={{ mt: 2 }}>
                    Back to texts
                </Button>
            </Page>
        );
    if (!text)
        return (
            <Page maxWidth="md">
                <Typography color="text.secondary">Loading text…</Typography>
            </Page>
        );
    const share = async () => {
        const url = new URL(text.permalink || `/texts/${encodeURIComponent(text.id)}/`, window.location.origin).href;
        try {
            if (navigator.share) await navigator.share({ title: text.title || "imshare text", text: text.textContent || "", url });
            else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
            else window.prompt("Copy this link:", url);
        } catch (cause) {
            if (!(cause instanceof DOMException && cause.name === "AbortError"))
                setError(cause instanceof Error ? cause.message : "Unable to share this text.");
        }
    };

    const submitReply = async () => {
        const body = reply.trim();
        if (!body || replying) return;
        setReplying(true);
        setReplyError("");
        try {
            await api(`/v1/posts/${encodeURIComponent(text.id)}/comments`, {
                method: "POST",
                body: JSON.stringify({ body }),
            });
            setReply("");
        } catch (cause) {
            setReplyError(cause instanceof Error ? cause.message : "Unable to post reply.");
        } finally {
            setReplying(false);
        }
    };

    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack spacing={0.5}>
                                <Typography variant="h3" component="h1">
                                    {text.title}
                                </Typography>
                                <Typography color="text.secondary">
                                    {text.author?.name || text.authorName} ·{" "}
                                    {text.createdAt
                                        ? new Date(text.createdAt).toLocaleString()
                                        : ""}
                                </Typography>
                            </Stack>
                            <Divider />
                            <Typography
                                sx={{
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                    fontSize: "1.08rem",
                                    lineHeight: 1.8,
                                }}
                            >
                                {text.textContent}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Button startIcon={<ShareOutlinedIcon />} onClick={() => void share()}>
                                    Share
                                </Button>
                                <Button startIcon={<ChatBubbleOutlineIcon />} onClick={() => document.getElementById("reply-box")?.focus()}>
                                    Reply
                                </Button>
                            </Stack>
                            <Stack id="replies" spacing={1}>
                                <TextField
                                    id="reply-box"
                                    label="Reply"
                                    value={reply}
                                    onChange={(event) => setReply(event.target.value)}
                                    multiline
                                    minRows={2}
                                    fullWidth
                                    error={Boolean(replyError)}
                                    helperText={replyError}
                                />
                                <Button
                                    variant="contained"
                                    onClick={() => void submitReply()}
                                    disabled={!reply.trim() || replying}
                                    sx={{ alignSelf: "flex-end" }}
                                >
                                    {replying ? "Replying…" : "Reply"}
                                </Button>
                            </Stack>
                            {text.tags?.length ? (
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    {text.tags.map((tag) => {
                                        const id = tag.id || tag.tag?.id;
                                        const name = tag.name || tag.tag?.name;
                                        return id && name ? (
                                            <Chip
                                                key={id}
                                                label={name}
                                                component="a"
                                                href={`/tags/${encodeURIComponent(id)}/`}
                                                clickable
                                            />
                                        ) : null;
                                    })}
                                </Stack>
                            ) : null}
                        </Stack>
                    </CardContent>
                </Card>
                <Button component="a" href="/texts/">
                    Back to texts
                </Button>
            </Stack>
        </Page>
    );
}
const root = document.querySelector("#text-page");
if (root)
    createRoot(root).render(
        <App>
            <TextPage />
        </App>,
    );
