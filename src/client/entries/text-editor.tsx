import {
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";

function TextEditor() {
    const editing = location.pathname.includes("/edit/");
    const textId = editing ? location.pathname.split("/").filter(Boolean).at(-2) : null;
    const [title, setTitle] = useState("");
    const [textContent, setTextContent] = useState("");
    const [status, setStatus] = useState("published");
    const [visibility, setVisibility] = useState("public");
    const [permalinkPattern, setPermalinkPattern] = useState<"user" | "posts">("user");
    const [permalinkIdType, setPermalinkIdType] = useState<
        "normalizedTitle" | "internalId" | "creationDate" | "custom"
    >("normalizedTitle");
    const [customPostId, setCustomPostId] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        if (!editing || !textId) return;
        void api<{ data: any }>(`/v1/texts/${encodeURIComponent(textId)}`)
            .then(({ data }) => {
                setTitle(data.title || "");
                setTextContent(data.textContent || "");
                setStatus(data.status || "published");
                setVisibility(data.visibility || "public");
                setPermalinkPattern(data.permalinkPattern || "user");
                setPermalinkIdType(data.permalinkIdType || "normalizedTitle");
                setCustomPostId(data.customPostId || "");
            })
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : "Unable to load text."),
            );
    }, [editing, textId]);
    const save = async () => {
        if (!title.trim() || !textContent.trim() || saving) return;
        setSaving(true);
        setError("");
        try {
            const body = JSON.stringify({
                title: title.trim(),
                textContent: textContent.trim(),
                status,
                visibility,
                permalinkPattern,
                permalinkIdType,
                customPostId: permalinkIdType === "custom" ? customPostId.trim() : null,
            });
            const response =
                editing && textId
                    ? await api<{ data: any }>(`/v1/texts/${encodeURIComponent(textId)}`, {
                          method: "PATCH",
                          body,
                      })
                    : await api<{ data: any }>("/v1/texts", { method: "POST", body });
            location.assign(
                response.data.permalink || `/texts/${encodeURIComponent(response.data.id)}/`,
            );
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save text.");
        } finally {
            setSaving(false);
        }
    };
    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {editing ? "Edit text" : "New text"}
                </Typography>
                {error ? <Typography color="error">{error}</Typography> : null}
                <TextField
                    label="Title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    fullWidth
                />
                <TextField
                    label="Text"
                    value={textContent}
                    onChange={(event) => setTextContent(event.target.value)}
                    required
                    fullWidth
                    multiline
                    minRows={12}
                    inputProps={{ maxLength: 100000 }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={status}
                            label="Status"
                            onChange={(event) => setStatus(event.target.value)}
                        >
                            <MenuItem value="draft">Draft</MenuItem>
                            <MenuItem value="published">Published</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Visibility</InputLabel>
                        <Select
                            value={visibility}
                            label="Visibility"
                            onChange={(event) => setVisibility(event.target.value)}
                        >
                            <MenuItem value="public">Public</MenuItem>
                            <MenuItem value="unlisted">Unlisted</MenuItem>
                            <MenuItem value="private">Private</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
                <Typography variant="h6">Permalink</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControl fullWidth>
                        <InputLabel>URL pattern</InputLabel>
                        <Select
                            value={permalinkPattern}
                            label="URL pattern"
                            onChange={(event) =>
                                setPermalinkPattern(event.target.value as typeof permalinkPattern)
                            }
                        >
                            <MenuItem value="user">
                                /{"{user}"}/{"{postId}"}
                            </MenuItem>
                            <MenuItem value="posts">/posts/{"{postId}"}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Post ID</InputLabel>
                        <Select
                            value={permalinkIdType}
                            label="Post ID"
                            onChange={(event) =>
                                setPermalinkIdType(event.target.value as typeof permalinkIdType)
                            }
                        >
                            <MenuItem value="normalizedTitle">Normalized title</MenuItem>
                            <MenuItem value="internalId">Internal Post ID</MenuItem>
                            <MenuItem value="creationDate">Creation date</MenuItem>
                            <MenuItem value="custom">Custom Post ID</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
                {permalinkIdType === "custom" ? (
                    <TextField
                        label="Custom Post ID"
                        value={customPostId}
                        onChange={(event) => setCustomPostId(event.target.value)}
                        required
                        fullWidth
                    />
                ) : null}
                <Stack direction="row" justifyContent="flex-end">
                    <Button
                        variant="contained"
                        onClick={() => void save()}
                        disabled={saving || !title.trim() || !textContent.trim()}
                    >
                        {saving ? "Saving…" : editing ? "Save changes" : "Create text"}
                    </Button>
                </Stack>
            </Stack>
        </Page>
    );
}
const root = document.querySelector("#text-editor-page");
if (root)
    createRoot(root).render(
        <App>
            <TextEditor />
        </App>,
    );
