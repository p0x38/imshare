import React from "https://esm.sh/react@19.1.1?target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?target=es2022";
import {
    Alert,
    AppBar,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CardMedia,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    IconButton,
    Skeleton,
    Stack,
    TextField,
    ThemeProvider,
    Toolbar,
    Tooltip,
    Typography,
    createTheme,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import MenuIcon from "https://esm.sh/@mui/icons-material@9.4.0/Menu?target=es2022";

export const h = React.createElement;

export const theme = createTheme({
    palette: {
        mode: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    },
    shape: { borderRadius: 3 },
    typography: { fontFamily: "Roboto, system-ui, sans-serif" },
    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
        },
    },
});

export async function api(url, options) {
    const client = window.imshareUI?.api;
    if (!client) throw new Error("API client is unavailable.");
    return client(url, options);
}

export function notify(message, severity = "info") {
    window.imshareUI?.showSnackbar?.(message, severity);
}

export function imageUrl(upload, width = 640) {
    if (!upload?.url) return null;
    const url = new URL(upload.url, window.location.origin);
    url.searchParams.set("width", String(width));
    url.searchParams.set("format", "webp");
    return url.href;
}

export function Navigation() {
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
            h(
                IconButton,
                { color: "inherit", component: "a", href: "/", "aria-label": "Home" },
                h(MenuIcon),
            ),
            h(
                Typography,
                {
                    component: "a",
                    href: "/",
                    variant: "h6",
                    sx: { mr: 1, color: "inherit", textDecoration: "none", fontWeight: 700 },
                },
                "imshare",
            ),
            h(
                Stack,
                { direction: "row", spacing: 0.5, useFlexGap: true, sx: { flexWrap: "wrap" } },
                ...links.map(([label, href]) =>
                    h(
                        Button,
                        { key: href, component: "a", href, color: "inherit", size: "small" },
                        label,
                    ),
                ),
            ),
        ),
    );
}

export function Page({ children, maxWidth = "xl" }) {
    return h(
        Box,
        { sx: { minHeight: "100vh" } },
        h(Navigation),
        h(Container, { maxWidth, sx: { py: 3 } }, children),
    );
}

export function LoadingState({ label = "Loading…" }) {
    return h(
        Stack,
        { alignItems: "center", spacing: 2, sx: { py: 6 } },
        h(CircularProgress),
        h(Typography, { color: "text.secondary" }, label),
    );
}

export function EmptyState({ title = "Nothing here yet", description = "There is nothing to display right now." }) {
    return h(
        Card,
        { variant: "outlined" },
        h(
            CardContent,
            { sx: { textAlign: "center" } },
            h(Typography, { variant: "h5", component: "h2", gutterBottom: true }, title),
            h(Typography, { color: "text.secondary" }, description),
        ),
    );
}

export function ErrorState({ title = "Something went wrong", description = "Please try again later." }) {
    return h(
        Alert,
        { severity: "error" },
        h(Typography, { component: "span", fontWeight: 700 }, title),
        ` — ${description}`,
    );
}

export function SkeletonGrid({ count = 8 }) {
    return h(
        Box,
        {
            sx: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 2,
            },
        },
        ...Array.from({ length: count }, (_, index) =>
            h(
                Card,
                { key: index, variant: "outlined" },
                h(Skeleton, { variant: "rectangular", sx: { aspectRatio: "1 / 1" } }),
                h(
                    CardContent,
                    null,
                    h(Skeleton, { variant: "text", width: "70%" }),
                    h(Skeleton, { variant: "text", width: "45%" }),
                ),
            ),
        ),
    );
}

export function PreviewCard({ title, image, href, author }) {
    const content = h(
        CardContent,
        null,
        h(Typography, { variant: "subtitle1", noWrap: true }, title || "Untitled"),
        author
            ? h(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, author)
            : null,
    );
    const media = image
        ? h(CardMedia, {
              component: "img",
              image,
              alt: title || "",
              loading: "lazy",
              sx: { aspectRatio: "1 / 1", objectFit: "cover" },
          })
        : h(Skeleton, { variant: "rectangular", sx: { aspectRatio: "1 / 1" } });
    return h(
        Card,
        { variant: "outlined", sx: { overflow: "hidden" } },
        media,
        href
            ? h("a", { href, style: { color: "inherit", textDecoration: "none" } }, content)
            : content,
    );
}

export function PostGrid({ posts = [], empty = false }) {
    if (empty) {
        return h(EmptyState, {
            title: "No posts found",
            description: "There are no posts matching this view yet.",
        });
    }
    return h(
        Box,
        {
            sx: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 2,
            },
        },
        ...posts.map((post) => {
            const upload = post.uploads?.[0];
            return h(PreviewCard, {
                key: post.id,
                title: post.title,
                image: imageUrl(upload, 480),
                href: `/posts/${encodeURIComponent(post.id)}`,
                author: post.author?.name || post.author?.username || "Unknown author",
            });
        }),
    );
}

export function mount(element, component) {
    if (!element) return null;
    const root = createRoot(element);
    root.render(h(ThemeProvider, { theme }, h(CssBaseline), component));
    return root;
}

export function App({ children }) {
    return h(ThemeProvider, { theme }, h(CssBaseline), children);
}

export { Avatar, Chip, Tooltip, React };
