import React from "https://esm.sh/react@19.1.1?target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?target=es2022";
import {
    AppBar,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CardMedia,
    Chip,
    CssBaseline,
    Skeleton,
    Stack,
    ThemeProvider,
    Toolbar,
    Typography,
    createTheme,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
let theme = createTheme({
    palette: {
        mode: systemThemeQuery.matches ? "dark" : "light",
        primary: {
            main: systemThemeQuery.matches ? "#90caf9" : "#1565c0",
        },
    },
    shape: {
        borderRadius: 3,
    },
    typography: {
        fontFamily: "Roboto, system-ui, sans-serif",
    },
});

const mountedRoots = new Set();

function Navigation() {
    const links = [
        ["Posts", "/posts/"],
        ["Users", "/users/"],
        ["Tags", "/tags/"],
        ["Categories", "/categories/"],
        ["Search", "/search/"],
        ["Account", "/account/"],
    ];

    return React.createElement(
        AppBar,
        { position: "static", elevation: 0 },
        React.createElement(
            Toolbar,
            {
                sx: {
                    gap: 1,
                    flexWrap: "wrap",
                    py: 1,
                    maxWidth: 1200,
                    width: "100%",
                    mx: "auto",
                },
            },
            React.createElement(
                Typography,
                {
                    component: "a",
                    href: "/",
                    variant: "h6",
                    sx: {
                        mr: 1,
                        color: "inherit",
                        textDecoration: "none",
                        fontWeight: 700,
                    },
                },
                "imshare",
            ),
            React.createElement(
                Stack,
                {
                    direction: "row",
                    spacing: 0.5,
                    useFlexGap: true,
                    sx: { flexWrap: "wrap" },
                },
                ...links.map(([label, href]) =>
                    React.createElement(
                        Button,
                        {
                            key: href,
                            component: "a",
                            href,
                            color: "inherit",
                            size: "small",
                        },
                        label,
                    ),
                ),
            ),
        ),
    );
}

function SkeletonGrid({ count = 8 }) {
    return React.createElement(
        Box,
        {
            sx: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 2,
                width: "100%",
            },
        },
        ...Array.from({ length: count }, (_, index) =>
            React.createElement(
                Card,
                { key: index, variant: "outlined" },
                React.createElement(Skeleton, {
                    variant: "rectangular",
                    animation: "wave",
                    sx: { aspectRatio: "1 / 1", width: "100%" },
                }),
                React.createElement(
                    CardContent,
                    null,
                    React.createElement(Skeleton, { variant: "text", animation: "wave", width: "75%" }),
                    React.createElement(Skeleton, { variant: "text", animation: "wave", width: "45%" }),
                ),
            ),
        ),
    );
}

function PreviewCard({ title, image, href, author, stats, tags = [] }) {
    const content = React.createElement(
        React.Fragment,
        null,
        image
            ? React.createElement(CardMedia, {
                  component: "img",
                  image,
                  alt: title || "",
                  loading: "lazy",
                  decoding: "async",
                  sx: { aspectRatio: "1 / 1", objectFit: "cover" },
              })
            : React.createElement(Skeleton, {
                  variant: "rectangular",
                  sx: { aspectRatio: "1 / 1", width: "100%" },
              }),
        React.createElement(
            CardContent,
            null,
            React.createElement(Typography, { variant: "h6", component: "h2", noWrap: true }, title),
            author
                ? React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, author)
                : null,
            stats
                ? React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, stats)
                : null,
            tags.length
                ? React.createElement(
                      Stack,
                      { direction: "row", spacing: 0.5, useFlexGap: true, sx: { mt: 1, flexWrap: "wrap" } },
                      ...tags.map((tag) => React.createElement(Chip, { key: tag, label: tag, size: "small" })),
                  )
                : null,
        ),
    );

    return React.createElement(
        Card,
        { variant: "outlined", sx: { height: "100%" } },
        href
            ? React.createElement(
                  CardActionArea,
                  { component: "a", href },
                  content,
              )
            : content,
    );
}

function PostGrid({ posts = [] }) {
    return React.createElement(
        Box,
        {
            sx: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 2,
                width: "100%",
            },
        },
        ...posts.map((post) => {
            const image = post.uploads?.[0];

            return React.createElement(PreviewCard, {
                key: post.id,
                title: post.title,
                image: image ? `${image.url}?width=480&height=480&fit=cover&format=webp` : null,
                href: `/posts/${encodeURIComponent(post.id)}`,
                author: post.author?.name ?? "Unknown author",
                stats: post.reactions
                    ? `♥ ${post.reactions.like || 0} · ★ ${post.reactions.favorite || 0} · ▣ ${post.reactions.save || 0}`
                    : null,
            });
        }),
    );
}

function mount(element, component) {
    if (!element) return null;

    const root = createRoot(element);
    mountedRoots.add(root);
    root.render(
        React.createElement(
            ThemeProvider,
            { theme },
            React.createElement(CssBaseline),
            component,
        ),
    );
    return root;
}

function updateTheme() {
    theme = createTheme({
        palette: {
            mode: systemThemeQuery.matches ? "dark" : "light",
            primary: {
                main: systemThemeQuery.matches ? "#90caf9" : "#1565c0",
            },
        },
        shape: {
            borderRadius: 3,
        },
        typography: {
            fontFamily: "Roboto, system-ui, sans-serif",
        },
    });

    for (const root of mountedRoots) {
        root.render(
            React.createElement(
                ThemeProvider,
                { theme },
                React.createElement(CssBaseline),
                root._imshareComponent,
            ),
        );
    }
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
    Navigation,
    SkeletonGrid,
    PreviewCard,
    PostGrid,
    get theme() {
        return theme;
    },
};
