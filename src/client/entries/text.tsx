import { Alert, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

function TextPage() {
    const textId = location.pathname.split("/").filter(Boolean).at(-1) || "";
    const [text, setText] = useState<Post | null>(null);
    const [error, setError] = useState("");
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
