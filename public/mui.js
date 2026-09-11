import React from "https://esm.sh/react@19.1.1?target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?target=es2022";
import {
    Alert,
    AppBar,
    Avatar,
    Badge,
    Box,
    Button,
    ButtonGroup,
    Card,
    CardActionArea,
    CardContent,
    CardMedia,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Skeleton,
    Snackbar,
    Stack,
    TextField,
    ThemeProvider,
    Toolbar,
    Tooltip,
    Typography,
    createTheme,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import MenuIcon from "https://esm.sh/@mui/icons-material@9.4.0/Menu?target=es2022";
import MoreVertIcon from "https://esm.sh/@mui/icons-material@9.4.0/MoreVert?target=es2022";
import FavoriteBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/FavoriteBorder?target=es2022";
import FavoriteIcon from "https://esm.sh/@mui/icons-material@9.4.0/Favorite?target=es2022";
import BookmarkBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/BookmarkBorder?target=es2022";
import BookmarkIcon from "https://esm.sh/@mui/icons-material/Bookmark?target=es2022";
import ThumbUpAltOutlinedIcon from "https://esm.sh/@mui/icons-material/ThumbUpAltOutlined?target=es2022";
import ThumbUpAltIcon from "https://esm.sh/@mui/icons-material/ThumbUpAlt?target=es2022";
import SearchIcon from "https://esm.sh/@mui/icons-material@9.4.0/Search?target=es2022";
import ArrowBackIcon from "https://esm.sh/@mui/icons-material@9.4.0/ArrowBack?target=es2022";
import ArrowForwardIcon from "https://esm.sh/@mui/icons-material@9.4.0/ArrowForward?target=es2022";

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
let theme;
const mountedRoots = new Map();
let feedbackRoot = null;
let feedbackHost = null;
let feedbackState = { open: false, message: "", severity: "info" };

function createImshareTheme() {
    return createTheme({
        palette: {
            mode: systemThemeQuery.matches ? "dark" : "light",
            primary: {
                main: systemThemeQuery.matches ? "#90caf9" : "#1565c0",
            },
        },
        shape: { borderRadius: 3 },
        typography: { fontFamily: "Roboto, system-ui, sans-serif" },
        components: {
            MuiButton: { defaultProps: { disableElevation: true } },
            MuiCard: { styleOverrides: { root: { overflow: "hidden" } } },
        },
    });
}

theme = createImshareTheme();

function Feedback() {
    return React.createElement(Snackbar, {
        open: feedbackState.open,
        autoHideDuration: 4000,
        onClose: () => {
            feedbackState = { ...feedbackState, open: false };
            feedbackRoot?.render(themedComponent(React.createElement(Feedback)));
        },
        anchorOrigin: { vertical: "bottom", horizontal: "right" },
    }, React.createElement(Alert, { severity: feedbackState.severity, variant: "filled" }, feedbackState.message));
}

function ensureFeedback() {
    if (!feedbackHost) {
        feedbackHost = document.createElement("div");
        feedbackHost.id = "mui-feedback";
        document.body.append(feedbackHost);
        feedbackRoot = createRoot(feedbackHost);
    }
    return feedbackRoot;
}

function showSnackbar(message, severity = "info") {
    feedbackState = { open: true, message, severity };
    ensureFeedback().render(themedComponent(React.createElement(Feedback)));
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
    return React.createElement(AppBar, { position: "static", elevation: 0 },
        React.createElement(Toolbar, { sx: { gap: 1, flexWrap: "wrap", py: 1, maxWidth: 1200, width: "100%", mx: "auto" } },
            React.createElement(Typography, { component: "a", href: "/", variant: "h6", sx: { mr: 1, color: "inherit", textDecoration: "none", fontWeight: 700 } }, "imshare"),
            React.createElement(Stack, { direction: "row", spacing: 0.5, useFlexGap: true, sx: { flexWrap: "wrap" } },
                ...links.map(([label, href]) => React.createElement(Button, { key: href, component: "a", href, color: "inherit", size: "small" }, label)),
            ),
        ),
    );
}

function SkeletonGrid({ count = 8 }) {
    return React.createElement(Box, { sx: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2, width: "100%" } },
        ...Array.from({ length: count }, (_, index) => React.createElement(Card, { key: index, variant: "outlined" },
            React.createElement(Skeleton, { variant: "rectangular", animation: "wave", sx: { aspectRatio: "1 / 1", width: "100%" } }),
            React.createElement(CardContent, null, React.createElement(Skeleton, { variant: "text", animation: "wave", width: "75%" }), React.createElement(Skeleton, { variant: "text", animation: "wave", width: "45%" })),
        )),
    );
}

function EmptyState({ title = "Nothing here yet", description = "There is nothing to display right now.", action = null }) {
    return React.createElement(Container, { maxWidth: "sm", sx: { py: 6 } },
        React.createElement(Card, { variant: "outlined" }, React.createElement(CardContent, { sx: { textAlign: "center" } },
            React.createElement(Typography, { variant: "h5", component: "h2", gutterBottom: true }, title),
            React.createElement(Typography, { color: "text.secondary", sx: { mb: action ? 2 : 0 } }, description),
            action,
        )),
    );
}

function ErrorState({ title = "Something went wrong", description = "Please try again later." }) {
    return EmptyState({ title, description });
}

function LoadingState({ label = "Loading…" }) {
    return React.createElement(Stack, { alignItems: "center", spacing: 2, sx: { py: 6 } }, React.createElement(CircularProgress), React.createElement(Typography, { color: "text.secondary" }, label));
}

function PreviewCard({ title, image, href, author, stats, tags = [] }) {
    const content = React.createElement(React.Fragment, null,
        image ? React.createElement(CardMedia, { component: "img", image, alt: title || "", loading: "lazy", decoding: "async", sx: { aspectRatio: "1 / 1", objectFit: "cover" } }) : React.createElement(Skeleton, { variant: "rectangular", sx: { aspectRatio: "1 / 1", width: "100%" } }),
        React.createElement(CardContent, null,
            React.createElement(Typography, { variant: "h6", component: "h2", noWrap: true }, title),
            author ? React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, author) : null,
            stats ? React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, stats) : null,
            tags.length ? React.createElement(Stack, { direction: "row", spacing: 0.5, useFlexGap: true, sx: { mt: 1, flexWrap: "wrap" } }, ...tags.map(tag => React.createElement(Chip, { key: tag, label: tag, size: "small" }))) : null,
        ),
    );
    return React.createElement(Card, { variant: "outlined", sx: { height: "100%" } }, href ? React.createElement(CardActionArea, { component: "a", href }, content) : content);
}

function PostGrid({ posts = [], empty = false, error = false, title = "No posts yet" }) {
    if (error) return React.createElement(ErrorState, { title: "Unable to load posts" });
    if (empty) return React.createElement(EmptyState, { title, description: "There are no posts matching this view yet." });
    return React.createElement(Box, { sx: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2, width: "100%" } },
        ...posts.map(post => {
            const image = post.uploads?.[0];
            return React.createElement(PreviewCard, {
                key: post.id,
                title: post.title,
                image: image ? `${image.url}?width=480&height=480&fit=cover&format=webp` : null,
                href: `/posts/${encodeURIComponent(post.id)}`,
                author: post.author?.name ?? "Unknown author",
                stats: post.reactions ? `♥ ${post.reactions.like || 0} · ★ ${post.reactions.favorite || 0} · ▣ ${post.reactions.save || 0}` : null,
                tags: post.tags?.map(item => item.name ?? item.tag?.name).filter(Boolean) ?? [],
            });
        }),
    );
}

function ActionButton({ active, label, count, onClick, icon, activeIcon, disabled = false }) {
    return React.createElement(Button, {
        startIcon: active ? activeIcon : icon,
        onClick,
        disabled,
        sx: { flex: 1, minWidth: 0 },
    }, count ? `${label} ${count}` : label);
}

function PostActions({ post }) {
    const [liked, setLiked] = React.useState(Boolean(post.viewer?.liked));
    const [favorited, setFavorited] = React.useState(Boolean(post.viewer?.favorited));
    const [saved, setSaved] = React.useState(Boolean(post.viewer?.saved));

    const toggle = async (kind, current, setter) => {
        try {
            await window.imshareUI.api(`/v1/posts/${encodeURIComponent(post.id)}/reactions/${kind}`, { method: current ? "DELETE" : "POST" });
            setter(!current);
        } catch (error) {
            showSnackbar(error instanceof Error ? error.message : "Unable to update reaction.", "error");
        }
    };

    return React.createElement(ButtonGroup, { fullWidth: true, variant: "outlined", sx: { display: "flex" } },
        React.createElement(ActionButton, { active: liked, label: "Like", count: post.reactions?.like, onClick: () => toggle("like", liked, setLiked), icon: React.createElement(ThumbUpAltOutlinedIcon), activeIcon: React.createElement(ThumbUpAltIcon) }),
        React.createElement(ActionButton, { active: favorited, label: "Favorite", count: post.reactions?.favorite, onClick: () => toggle("favorite", favorited, setFavorited), icon: React.createElement(FavoriteBorderIcon), activeIcon: React.createElement(FavoriteIcon) }),
        React.createElement(ActionButton, { active: saved, label: "Save", count: post.reactions?.save, onClick: () => toggle("save", saved, setSaved), icon: React.createElement(BookmarkBorderIcon), activeIcon: React.createElement(BookmarkIcon) }),
        React.createElement(Tooltip, { title: "More actions" }, React.createElement(IconButton, { "aria-label": "More actions" }, React.createElement(MoreVertIcon))),
    );
}

function RecommendationSidebar({ posts = [] }) {
    if (!posts.length) return null;
    return React.createElement(Stack, { spacing: 2 },
        React.createElement(Typography, { variant: "h6", component: "h2" }, "Recommended"),
        ...posts.slice(0, 5).map(post => React.createElement(PreviewCard, {
            key: post.id,
            title: post.title,
            image: post.uploads?.[0] ? `${post.uploads[0].url}?width=480&height=320&fit=cover&format=webp` : null,
            href: `/posts/${encodeURIComponent(post.id)}`,
            author: post.author?.name,
        })),
    );
}

function PostPage({ post, recommendations = [] }) {
    const profileUrl = `/users/${encodeURIComponent(post.author?.id ?? "")}`;
    const image = post.imageUrl || (post.image ? `${post.image.url}?width=1600&format=webp` : null);

    return React.createElement(Box, { sx: { minHeight: "100vh" } },
        React.createElement(Box, { sx: { display: { xs: "block", md: "none" } } }, React.createElement(AppBar, { position: "static" }, React.createElement(Toolbar, null,
            React.createElement(IconButton, { color: "inherit", href: "/", "aria-label": "Home" }, React.createElement(MenuIcon)),
            React.createElement(Typography, { variant: "h6", sx: { flex: 1 } }, "imshare"),
            React.createElement(IconButton, { color: "inherit", component: "a", href: profileUrl, "aria-label": "Profile" }, React.createElement(Avatar, { sx: { width: 32, height: 32 } }, (post.authorName || "?").charAt(0).toUpperCase())),
        )),
        React.createElement(Container, { maxWidth: "xl", sx: { py: { xs: 1, md: 3 } } },
            React.createElement(Box, { sx: { display: { xs: "block", md: "grid" }, gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 3 } },
                React.createElement(Box, null,
                    React.createElement(Card, { variant: "outlined", sx: { overflow: "hidden" } },
                        image ? React.createElement(CardMedia, { component: "img", image, alt: post.caption || post.title || "Image", sx: { width: "100%", maxHeight: { xs: "70vh", md: "80vh" }, objectFit: "contain", bgcolor: "background.default" } }) : React.createElement(Skeleton, { variant: "rectangular", sx: { width: "100%", aspectRatio: "4 / 3" } }),
                        post.caption ? React.createElement(CardContent, null, React.createElement(Typography, { variant: "body1" }, post.caption)) : null,
                    ),
                    React.createElement(Stack, { spacing: 1, sx: { py: 2 } },
                        React.createElement(Typography, { variant: "h6", component: "h1" }, `${post.title || "Untitled"} by ${post.authorName}`),
                        React.createElement(Typography, { component: "a", href: profileUrl, color: "text.secondary", sx: { textDecoration: "none" } }, `@${post.authorName}`),
                        React.createElement(PostActions, { post }),
                        post.tags?.length ? React.createElement(Stack, { direction: "row", spacing: 0.5, useFlexGap: true, sx: { flexWrap: "wrap" } }, ...post.tags.map(tag => React.createElement(Chip, { key: tag.id ?? tag.name, label: tag.name ?? tag.tag?.name, size: "small", component: "a", href: `/tags/${encodeURIComponent(tag.id ?? tag.tag?.id ?? "")}` }))) : null,
                    ),
                ),
                React.createElement(Box, { sx: { display: { xs: "block", md: "block" } } }, React.createElement(RecommendationSidebar, { posts: recommendations })),
            ),
        ),
    );
}

function DialogPrompt({ open, title, children, onClose, actions }) {
    return React.createElement(Dialog, { open, onClose }, React.createElement(DialogTitle, null, title), React.createElement(DialogContent, null, children), React.createElement(DialogActions, null, actions));
}

function themedComponent(component) {
    return React.createElement(ThemeProvider, { theme }, React.createElement(CssBaseline), component);
}

function mount(element, component) {
    if (!element) return null;
    const root = createRoot(element);
    mountedRoots.set(root, component);
    root.render(themedComponent(component));
    return root;
}

function render(root, component) {
    if (!root) return null;
    mountedRoots.set(root, component);
    root.render(themedComponent(component));
    return root;
}

function updateTheme() {
    theme = createImshareTheme();
    for (const [root, component] of mountedRoots) root.render(themedComponent(component));
    if (feedbackRoot && feedbackState.open) feedbackRoot.render(themedComponent(React.createElement(Feedback)));
}

systemThemeQuery.addEventListener("change", updateTheme);

const originalHeader = document.querySelector("body > header");
if (originalHeader) {
    const mountPoint = document.createElement("div");
    originalHeader.replaceWith(mountPoint);
    mountPoint.id = "mui-header";
    mount(mountPoint, React.createElement(Navigation));
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
    PostPage,
    DialogPrompt,
    PostActions,
    Pagination: null,
    showSnackbar,
    get theme() { return theme; },
};
