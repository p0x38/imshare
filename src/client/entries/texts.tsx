import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    IconButton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import RepeatIcon from "@mui/icons-material/Repeat";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { ErrorState, SkeletonGrid } from "../components/States";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

const TEXT_LIMIT = 500;
interface TextsResponse {
    data?: Post[];
    pagination?: { totalPages?: number };
}

function TextComposer({ onCreated }: { onCreated: () => void }) {
    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState("");
    const submit = async () => {
        const value = text.trim();
        if (!value || posting || value.length > TEXT_LIMIT) return;
        setPosting(true);
        setError("");
        try {
            await api("/v1/texts", {
                method: "POST",
                body: JSON.stringify({
                    title: value.slice(0, 80),
                    textContent: value,
                    status: "published",
                    visibility: "public",
                }),
            });
            setText("");
            onCreated();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to post text.");
        } finally {
            setPosting(false);
        }
    };
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.5}>
                    <TextField
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder="What's happening?"
                        multiline
                        minRows={3}
                        maxRows={8}
                        fullWidth
                        inputProps={{ maxLength: TEXT_LIMIT }}
                        error={Boolean(error)}
                        helperText={error || `${text.length}/${TEXT_LIMIT}`}
                    />
                    <Stack direction="row" justifyContent="flex-end">
                        <Button
                            variant="contained"
                            onClick={() => void submit()}
                            disabled={!text.trim() || posting || text.length > TEXT_LIMIT}
                        >
                            {posting ? "Posting…" : "Post"}
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function TextCard({ text }: { text: Post }) {
    const author = text.author?.name || text.authorName || "Unknown user";
    const handle = text.author?.handle ? `@${text.author.handle}` : "";
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar src={text.author?.image || undefined}>
                        {author[0]?.toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                            <Typography fontWeight={700}>{author}</Typography>
                            {handle ? (
                                <Typography color="text.secondary">{handle}</Typography>
                            ) : null}
                            <Typography color="text.secondary" variant="body2">
                                · {text.createdAt ? new Date(text.createdAt).toLocaleString() : ""}
                            </Typography>
                        </Stack>
                        <Typography
                            component="a"
                            href={`/texts/${encodeURIComponent(text.id)}/`}
                            sx={{
                                color: "inherit",
                                textDecoration: "none",
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                                display: "block",
                                mt: 0.75,
                            }}
                        >
                            {text.textContent}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, ml: -1 }}>
                            <IconButton size="small" aria-label="Reply">
                                <ChatBubbleOutlineIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label="Repost">
                                <RepeatIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label="Like">
                                <FavoriteBorderIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}

function TextsPage() {
    const params = new URLSearchParams(location.search);
    const [query, setQuery] = useState(params.get("search") || "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [texts, setTexts] = useState<Post[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const requestParams = new URLSearchParams({ page: String(page), limit: "24" });
            if (query.trim()) requestParams.set("search", query.trim());
            const response = await api<TextsResponse>(`/v1/texts?${requestParams}`);
            setTexts(response.data || []);
            setTotalPages(Math.max(1, response.pagination?.totalPages || 1));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load texts.");
        } finally {
            setLoading(false);
        }
    }, [page, query]);
    useEffect(() => {
        void load();
    }, [load]);
    return (
        <Page maxWidth="sm">
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    Texts
                </Typography>
                <TextComposer
                    onCreated={() => {
                        setPage(1);
                        void load();
                    }}
                />
                <Stack
                    component="form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setPage(1);
                    }}
                >
                    <TextField
                        size="small"
                        label="Search texts"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        fullWidth
                    />
                </Stack>
                {loading ? (
                    <SkeletonGrid count={5} />
                ) : error ? (
                    <ErrorState message={error} />
                ) : texts.length ? (
                    <Stack divider={<Divider flexItem />} spacing={1.5}>
                        {texts.map((text) => (
                            <TextCard key={text.id} text={text} />
                        ))}
                    </Stack>
                ) : (
                    <Typography color="text.secondary">No texts yet.</Typography>
                )}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Button
                        disabled={page <= 1}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                        Previous
                    </Button>
                    <Typography color="text.secondary">
                        Page {page} / {totalPages}
                    </Typography>
                    <Button
                        disabled={page >= totalPages}
                        onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    >
                        Next
                    </Button>
                </Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#texts-page");
if (root)
    createRoot(root).render(
        <App>
            <TextsPage />
        </App>,
    );
