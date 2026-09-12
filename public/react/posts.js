import { useCallback, useEffect, useState } from "https://esm.sh/react@19.1.1?target=es2022";
import {
    Button,
    Stack,
    TextField,
    Typography,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import { api, h, mount, Page, PostGrid, SkeletonGrid } from "/react/core.js";

function PostsPage() {
    const params = new URLSearchParams(location.search);
    const [query, setQuery] = useState(params.get("search") || "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [posts, setPosts] = useState([]);
    const [pagination, setPagination] = useState({ totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const requestParams = new URLSearchParams({ page: String(page), limit: "48" });
            if (query.trim()) requestParams.set("search", query.trim());
            const response = await api(`/v1/posts?${requestParams}`);
            setPosts(response.data || []);
            setPagination(response.pagination || { totalPages: 1 });
            const historyParams = new URLSearchParams();
            if (query.trim()) historyParams.set("search", query.trim());
            historyParams.set("page", String(response.pagination?.page || page));
            history.replaceState(null, "", `?${historyParams}`);
            document.title = query.trim() ? `Search: ${query.trim()} · imshare` : "Posts · imshare";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load posts.");
        } finally {
            setLoading(false);
        }
    }, [page, query]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = (event) => {
        event.preventDefault();
        setPage(1);
    };

    const totalPages = Math.max(1, pagination.totalPages || 1);
    return h(
        Page,
        null,
        h(
            Stack,
            { spacing: 2 },
            h(Typography, { variant: "h4", component: "h1" }, "Posts"),
            h(
                Stack,
                { component: "form", onSubmit: submit, direction: { xs: "column", sm: "row" }, spacing: 1 },
                h(TextField, { fullWidth: true, size: "small", label: "Search posts", value: query, onChange: (event) => setQuery(event.target.value) }),
                h(Button, { type: "submit", variant: "contained" }, "Search"),
            ),
            loading ? h(SkeletonGrid, { count: 12 }) : error ? h("div", { role: "alert" }, error) : h(PostGrid, { posts, empty: posts.length === 0 }),
            h(
                Stack,
                { direction: "row", justifyContent: "space-between", alignItems: "center" },
                h(Button, { disabled: page <= 1, onClick: () => setPage((value) => Math.max(1, value - 1)) }, "Previous"),
                h(Typography, { color: "text.secondary" }, `Page ${page} / ${totalPages}`),
                h(Button, { disabled: page >= totalPages, onClick: () => setPage((value) => Math.min(totalPages, value + 1)) }, "Next"),
            ),
        ),
    );
}

const root = document.querySelector("#posts-page");
if (root) mount(root, h(PostsPage));
