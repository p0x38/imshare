import React from "https://esm.sh/react@19.1.1?bundle&target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?bundle&target=es2022";
import {
    AppBar,
    Box,
    Button,
    Card,
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
} from "https://esm.sh/@mui/material@9.4.0?bundle&target=es2022";

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#90caf9",
        },
        background: {
            default: "#101114",
            paper: "#191b20",
        },
    },
    shape: {
        borderRadius: 3,
    },
    typography: {
        fontFamily: "Roboto, system-ui, sans-serif",
    },
});

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
            { sx: { gap: 1, flexWrap: "wrap", py: 1 } },
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

function PreviewCard({ title, image, tags = [] }) {
    return React.createElement(
        Card,
        { variant: "outlined" },
        image
            ? React.createElement(CardMedia, {
                  component: "img",
                  image,
                  alt: title || "",
                  loading: "lazy",
                  sx: { aspectRatio: "1 / 1", objectFit: "cover" },
              })
            : null,
        React.createElement(
            CardContent,
            null,
            React.createElement(Typography, { variant: "h6", component: "h2" }, title),
            tags.length
                ? React.createElement(
                      Stack,
                      { direction: "row", spacing: 0.5, useFlexGap: true, sx: { mt: 1, flexWrap: "wrap" } },
                      ...tags.map((tag) => React.createElement(Chip, { key: tag, label: tag, size: "small" })),
                  )
                : null,
        ),
    );
}

function mount(element, component) {
    if (!element) return null;
    const root = createRoot(element);
    root.render(
        React.createElement(ThemeProvider, { theme }, React.createElement(CssBaseline), component),
    );
    return root;
}

const originalHeader = document.querySelector("body > header");
if (originalHeader) {
    const mountPoint = document.createElement("div");
    originalHeader.replaceWith(mountPoint);
    mountPoint.id = "mui-header";
    mount(mountPoint, React.createElement(Navigation));
}

window.imshareMUI = {
    mount,
    SkeletonGrid,
    PreviewCard,
    theme,
};
