import React from "https://esm.sh/react@19.1.1?target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?target=es2022";
import { Alert, AppBar, Avatar, Box, Button, ButtonGroup, Card, CardContent, CardMedia, Chip, CircularProgress, Container, CssBaseline, IconButton, Skeleton, Snackbar, Stack, TextField, ThemeProvider, Toolbar, Tooltip, Typography, createTheme } from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import MenuIcon from "https://esm.sh/@mui/icons-material@9.4.0/Menu?target=es2022";
import MoreVertIcon from "https://esm.sh/@mui/icons-material@9.4.0/MoreVert?target=es2022";
import FavoriteBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/FavoriteBorder?target=es2022";
import FavoriteIcon from "https://esm.sh/@mui/icons-material@9.4.0/Favorite?target=es2022";
import BookmarkBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/BookmarkBorder?target=es2022";
import BookmarkIcon from "https://esm.sh/@mui/icons-material@9.4.0/Bookmark?target=es2022";
import ThumbUpAltOutlinedIcon from "https://esm.sh/@mui/icons-material@9.4.0/ThumbUpAltOutlined?target=es2022";
import ThumbUpAltIcon from "https://esm.sh/@mui/icons-material@9.4.0/ThumbUpAlt?target=es2022";

window.React = React;

const theme = createTheme({
    palette: {
        mode: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    },
    shape: { borderRadius: 3 },
    typography: { fontFamily: "Roboto, system-ui, sans-serif" },
    components: {
        MuiButton: { defaultProps: { disableElevation: true } },
    },
});

const h = React.createElement;
const roots = new Set();
let snackbarRoot;
let snackbarHost;
let snackbarState = { open: false, message: "", severity: "info" };

function themed(component) {
    return h(ThemeProvider, { theme }, h(CssBaseline), component);
}

function showSnackbar(message, severity = "info") {
    snackbarState = { open: true, message, severity };
    if (!snackbarHost) {
        snackbarHost = document.createElement("div");
        document.body.append(snackbarHost);
        snackbarRoot = createRoot(snackbarHost);
    }
    const close = () => {
        snackbarState = { ...snackbarState, open: false };
        snackbarRoot.render(themed(h(SnackbarView)));
    };
    snackbarRoot.render(themed(h(SnackbarView, { close })));
}

function SnackbarView({ close }) {
    const dismiss = close || (() => undefined);
    return h(
        Snackbar,
        { open: snackbarState.open, autoHideDuration: 4000, onClose: dismiss },
        h(Alert, { severity: snackbarState.severity, variant: "filled", onClose: dismiss }, snackbarState.message),
    );
}

function Navigation() {
    const links = [
        ["Posts", "/posts/"],
        ["Users", "/users/"],
        ["Tags", "/tags/"],
        ["Categories", "/categories/"],
        ["Search", "/search/"],
        ["Notifications", "/notifications/"],
        ["Account", "/account/"],
    ];
    return h(
        AppBar,
        { position: "static", elevation: 0 },
        h(
            Toolbar,
            { sx: { gap: 1, flexWrap: "wrap", maxWidth: 1200, width: "100%", mx: "auto" } },
            h(Typography, { component: "a", href: "/", variant: "h6", sx: { mr: 1, color: "inherit", textDecoration: "none", fontWeight: 700 } }, "imshare"),
            h(
                Stack,
                { direction: "row", spacing: 0.5, useFlexGap: true, sx: { flexWrap: "wrap" } },
                ...links.map(([label, href]) => h(Button, { key: href, component: "a", href, color: "inherit", size: "small" }, label)),
            ),
        ),
    );
}

function LoadingState({ label = "Loading…" }) {
    return h(Stack, { alignItems: "center", spacing: 2, sx: { py: 6 } }, h(CircularProgress), h(Typography, { color: "text.secondary" }, label));
}

function EmptyState({ title = "Nothing here yet", description = "There is nothing to display right now." }) {
    return h(Container, { maxWidth: "sm", sx: { py: 6 } }, h(Card, { variant: "outlined" }, h(CardContent, { sx: { textAlign: "center" } }, h(Typography, { variant: "h5", component: "h2", gutterBottom: true }, title), h(Typography, { color: "text.secondary" }, description))));
}

function ErrorState({ title = "Something went wrong", description = "Please try again later." }) {
    return h(Alert, { severity: "error", sx: { my: 2 } }, h(Typography, { component: "span", fontWeight: 700 }, title), ` — ${description}`);
}

function SkeletonGrid({ count = 8 }) {
    return h(
        Box,
        { sx: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 } },
        ...Array.from({ length: count }, (_, index) => h(Card, { key: index, variant: "outlined" }, h(Skeleton, { variant: "rectangular", sx: { aspectRatio: "1 / 1" } }), h(CardContent, null, h(Skeleton, { variant: "text", width: "70%" }), h(Skeleton, { variant: "text", width: "45%" })))),
    );
}

function PreviewCard({ title, image, href, author }) {
    const content = h(
        CardContent,
        null,
        h(Typography, { variant: "h6", noWrap: true }, title || "Untitled"),
        author ? h(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, author) : null,
    );
    return h(Card, { variant: "outlined", sx: { overflow: "hidden" } }, image ? h(CardMedia, { component: "img", image, alt: title || "", loading: "lazy", sx: { aspectRatio: "1 / 1", objectFit: "cover" } }) : h(Skeleton, { variant: "rectangular", sx: { aspectRatio: "1 / 1" } }), href ? h("a", { href, style: { color: "inherit", textDecoration: "none" } }, content) : content);
}

function PostGrid({ posts = [], empty = false, error = false }) {
    if (error) return h(ErrorState, { title: "Unable to load posts", description: error });
    if (empty) return h(EmptyState, { title: "No posts found", description: "There are no posts matching this view yet." });
    return h(
        Box,
        { sx: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 } },
        ...posts.map((post) => {
            const upload = post.uploads?.[0];
            const image = upload?.url ? `${upload.url}?width=480&height=480&fit=cover&format=webp` : null;
            return h(PreviewCard, { key: post.id, title: post.title, image, href: `/posts/${encodeURIComponent(post.id)}`, author: post.author?.name || post.author?.username || "Unknown author" });
        }),
    );
}

function PostsPage({ api }) {
    const [posts, setPosts] = React.useState([]);
    const [status, setStatus] = React.useState("loading");
    const [error, setError] = React.useState("");
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [pagination, setPagination] = React.useState({ totalPages: 1 });
    const load = React.useCallback(async () => {
        setStatus("loading");
        setError("");
        try {
            const query = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
            const response = await api(`/v1/posts?page=${page}&limit=48${query}`);
            setPosts(response.data || []);
            setPagination(response.pagination || { totalPages: 1 });
            setStatus("ready");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load posts");
            setStatus("error");
        }
    }, [api, page, search]);
    React.useEffect(() => { load(); }, [load]);
    const submit = (event) => {
        event.preventDefault();
        setPage(1);
        if (page === 1) load();
    };
    const totalPages = Math.max(1, pagination.totalPages || 1);
    return h(
        Box,
        { sx: { minHeight: "100vh" } },
        h(Navigation),
        h(
            Container,
            { maxWidth: "xl", sx: { py: 3 } },
            h(Stack, { spacing: 2 },
                h(Typography, { variant: "h4", component: "h1" }, "Posts"),
                h("form", { onSubmit: submit }, h(TextField, { fullWidth: true, label: "Search", value: search, onChange: (event) => setSearch(event.target.value) })),
                status === "loading" ? h(SkeletonGrid) : status === "error" ? h(ErrorState, { title: "Unable to load posts", description: error }) : h(PostGrid, { posts, empty: posts.length === 0 }),
                h(Stack, { direction: "row", justifyContent: "space-between", alignItems: "center" },
                    h(Button, { disabled: page <= 1, onClick: () => setPage((value) => Math.max(1, value - 1)) }, "Previous"),
                    h(Typography, { color: "text.secondary" }, `Page ${page} / ${totalPages}`),
                    h(Button, { disabled: page >= totalPages, onClick: () => setPage((value) => Math.min(totalPages, value + 1)) }, "Next"),
                ),
            ),
        ),
    );
}

function ActionButton({ active, label, count, onClick, icon, activeIcon }) {
    return h(Button, { onClick, startIcon: active ? activeIcon : icon, sx: { minWidth: 0, flex: 1 } }, count ? `${label} ${count}` : label);
}

function PostActions({ post }) {
    const [liked, setLiked] = React.useState(Boolean(post.viewer?.liked));
    const [favorited, setFavorited] = React.useState(Boolean(post.viewer?.favorited));
    const [saved, setSaved] = React.useState(Boolean(post.viewer?.saved));
    const toggle = async (kind, current, setter) => {
        try {
            const api = window.imshareUI?.api;
            if (!api) throw new Error("API client is unavailable");
            await api(`/v1/posts/${encodeURIComponent(post.id)}/reactions/${kind}`, { method: current ? "DELETE" : "POST" });
            setter(!current);
        } catch (cause) {
            showSnackbar(cause instanceof Error ? cause.message : "Unable to update reaction", "error");
        }
    };
    return h(ButtonGroup, { fullWidth: true, variant: "outlined", sx: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)" } },
        h(ActionButton, { active: liked, label: "Like", count: post.reactions?.like, onClick: () => toggle("like", liked, setLiked), icon: h(ThumbUpAltOutlinedIcon), activeIcon: h(ThumbUpAltIcon) }),
        h(ActionButton, { active: favorited, label: "Favorite", count: post.reactions?.favorite, onClick: () => toggle("favorite", favorited, setFavorited), icon: h(FavoriteBorderIcon), activeIcon: h(FavoriteIcon) }),
        h(ActionButton, { active: saved, label: "Save", count: post.reactions?.save, onClick: () => toggle("save", saved, setSaved), icon: h(BookmarkBorderIcon), activeIcon: h(BookmarkIcon) }),
        h(Tooltip, { title: "More actions" }, h(IconButton, { "aria-label": "More actions" }, h(MoreVertIcon))),
    );
}

function RecommendationSidebar({ posts = [] }) {
    if (!posts.length) return null;
    return h(Stack, { spacing: 2 }, h(Typography, { variant: "h6", component: "h2" }, "Recommended"), ...posts.slice(0, 5).map((post) => {
        const image = post.uploads?.[0];
        return h(PreviewCard, { key: post.id, title: post.title, image: image?.url || null, href: `/posts/${encodeURIComponent(post.id)}`, author: post.author?.name || "Unknown author" });
    }));
}

function PostPage({ post, recommendations = [] }) {
    const author = post.author || {};
    const authorName = post.authorName || author.name || author.username || "Unknown author";
    const profileUrl = author.id ? `/users/${encodeURIComponent(author.id)}` : "/users/";
    const image = post.imageUrl || post.image?.url || post.uploads?.[0]?.url || null;
    return h(
        Box,
        { sx: { minHeight: "100vh" } },
        h(Box, { sx: { display: { xs: "block", md: "none" } } }, h(AppBar, { position: "static" }, h(Toolbar, null, h(IconButton, { color: "inherit", href: "/", "aria-label": "Home" }, h(MenuIcon)), h(Typography, { variant: "h6", sx: { flex: 1 } }, "imshare"), h(IconButton, { color: "inherit", component: "a", href: profileUrl, "aria-label": "Profile" }, h(Avatar, { sx: { width: 32, height: 32 } }, authorName.charAt(0).toUpperCase()))))),
        h(Container, { maxWidth: "xl", sx: { py: { xs: 1, md: 3 } } },
            h(Box, { sx: { display: { xs: "block", md: "grid" }, gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 3 } },
                h(Box, null,
                    h(Card, { variant: "outlined" }, image ? h(CardMedia, { component: "img", image, alt: post.caption || post.title || "Image", sx: { width: "100%", maxHeight: { xs: "70vh", md: "80vh" }, objectFit: "contain" } }) : h(Skeleton, { variant: "rectangular", sx: { width: "100%", aspectRatio: "4 / 3" } }), post.caption ? h(CardContent, null, h(Typography, null, post.caption)) : null),
                    h(Stack, { spacing: 1.25, sx: { py: 2 } },
                        h(Typography, { variant: "h6", component: "h1" }, `${post.title || "Untitled"} by ${authorName}`),
                        h(Typography, { component: "a", href: profileUrl, color: "text.secondary", sx: { textDecoration: "none" } }, `@${authorName}`),
                        h(PostActions, { post }),
                        post.tags?.length ? h(Stack, { direction: "row", spacing: 0.5, useFlexGap: true, sx: { flexWrap: "wrap" } }, ...post.tags.map((tag) => h(Chip, { key: tag.id || tag.name, label: tag.name || tag.tag?.name, size: "small" }))) : null,
                    ),
                ),
                h(Box, { sx: { display: { xs: "none", md: "block" } } }, h(RecommendationSidebar, { posts: recommendations })),
            ),
        ),
    );
}

function DialogPrompt({ open, title, children, onClose, actions }) {
    return h("div", null, open ? h("div", null, title, children, actions) : null);
}

function mount(element, component) {
    if (!element) return null;
    const root = createRoot(element);
    roots.add(root);
    root.render(themed(component));
    return root;
}

function render(root, component) {
    if (!root) return null;
    roots.add(root);
    root.render(themed(component));
    return root;
}

window.imshareMUI = {
    mount,
    render,
    Navigation,
    SkeletonGrid,
    EmptyState,
    ErrorState,
    LoadingState,
    PreviewCard,
    PostGrid,
    PostsPage,
    PostPage,
    DialogPrompt,
    PostActions,
    showSnackbar,
    theme,
};
