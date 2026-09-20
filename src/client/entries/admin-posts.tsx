import {
    Alert,
    Button,
    Card,
    CardContent,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    Pagination,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";
const PAGE_SIZE = 100;

interface Post {
    id: string;
    title: string;
    status: string;
    visibility: string;
    hiddenAt: string | null;
    createdAt: string;
    user: { name: string; handle: string | null };
    _count: { reports: number; comments: number; reactions: number };
}
function AdminPostsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<Post | null>(null);
    const [title, setTitle] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [status, setStatus] = useState("published");
    const [allowDownload, setAllowDownload] = useState(true);
    const [reason, setReason] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const load = async (targetPage: number) => {
        try {
            const offset = (targetPage - 1) * PAGE_SIZE;
            const r = await api<{ data: { posts: Post[]; total: number } }>(
                `/v1/admin/posts?limit=${PAGE_SIZE}&offset=${offset}`,
            );
            setPosts(r.data.posts);
            setTotal(r.data.total);
            return r.data.posts;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load posts.");
            return null;
        }
    };
    useEffect(() => {
        void load(page);
    }, [page]);
    const edit = async () => {
        if (!selected) return;
        try {
            await api(`/v1/admin/posts/${selected.id}`, {
                method: "PATCH",
                body: JSON.stringify({ title, visibility, status, allowDownload }),
            });
            setSelected(null);
            await load(page);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to update post.");
        }
    };
    const remove = async () => {
        if (!selected) return;
        try {
            await api(`/v1/admin/posts/${selected.id}`, {
                method: "DELETE",
                body: JSON.stringify({ reason }),
            });
            setSelected(null);
            if (posts.length === 1 && page > 1) setPage(page - 1);
            else await load(page);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete post.");
        }
    };
    return (
        <AdminLayout
            title="Posts"
            description="Review and manage posts across the instance."
            activeHref="/admin/posts/"
        >
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack spacing={1.5}>
                {posts.map((p) => (
                    <Card variant="outlined" key={p.id}>
                        <CardContent>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={2}
                                justifyContent="space-between"
                            >
                                <Stack spacing={0.5}>
                                    <Typography variant="h6">{p.title}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        by {p.user.handle ? `@${p.user.handle}` : p.user.name} ·{" "}
                                        {new Date(p.createdAt).toLocaleString()}
                                    </Typography>
                                    <Typography variant="body2">
                                        {p.status} · {p.visibility} · {p._count.reports} reports ·{" "}
                                        {p._count.comments} comments
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            setSelected(p);
                                            setTitle(p.title);
                                            setVisibility(p.visibility);
                                            setStatus(p.status);
                                            setAllowDownload(true);
                                            setReason("");
                                        }}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        color="error"
                                        variant="outlined"
                                        onClick={() => {
                                            setSelected(p);
                                            setTitle(p.title);
                                            setReason("");
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
                        {total > PAGE_SIZE ? (
                <Stack spacing={1.5} alignItems="center" sx={{ pt: 1 }}>
                    <Pagination
                        count={Math.ceil(total / PAGE_SIZE)}
                        page={page}
                        onChange={(_, value) => setPage(value)}
                        showFirstButton
                        showLastButton
                        color="primary"
                    />
                    <Typography variant="body2" color="text.secondary">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} posts
                    </Typography>
                </Stack>
            ) : null}
            <Dialog
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Manage post</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <TextField
                            label="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            select
                            label="Status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <MenuItem value="published">Published</MenuItem>
                            <MenuItem value="draft">Draft</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label="Visibility"
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value)}
                        >
                            <MenuItem value="public">Public</MenuItem>
                            <MenuItem value="unlisted">Unlisted</MenuItem>
                            <MenuItem value="private">Private</MenuItem>
                        </TextField>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allowDownload}
                                    onChange={(e) => setAllowDownload(e.target.checked)}
                                />
                            }
                            label="Allow downloads"
                        />
                        <TextField
                            label="Deletion reason (used when deleting)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            multiline
                            minRows={2}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelected(null)}>Cancel</Button>
                    <Button variant="outlined" onClick={() => void edit()}>
                        Save changes
                    </Button>
                    <Button color="error" variant="contained" onClick={() => void remove()}>
                        Delete post
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
const root = document.querySelector("#admin-posts-page");
if (root)
    createRoot(root).render(
        <App>
            <AdminPostsPage />
        </App>,
    );
