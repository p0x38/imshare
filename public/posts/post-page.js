import React from "https://esm.sh/react@19.1.1?target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?target=es2022";
import {
    AppBar,
    Avatar,
    Box,
    Card,
    CardContent,
    CardMedia,
    Chip,
    Container,
    IconButton,
    Stack,
    ThemeProvider,
    ToggleButton,
    Tooltip,
    Toolbar,
    Typography,
    createTheme,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import MenuIcon from "https://esm.sh/@mui/icons-material@9.4.0/Menu?target=es2022";
import MoreVertIcon from "https://esm.sh/@mui/icons-material@9.4.0/MoreVert?target=es2022";
import FavoriteBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/FavoriteBorder?target=es2022";
import FavoriteIcon from "https://esm.sh/@mui/icons-material@9.4.0/Favorite?target=es2022";
import BookmarkBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/BookmarkBorder?target=es2022";
import BookmarkIcon from "https://esm.sh/@mui/icons-material@9.4.0/Bookmark?target=es2022";
import ThumbUpAltOutlinedIcon from "https://esm.sh/@mui/icons-material@9.4.0/ThumbUpAltOutlined?target=es2022";
import ThumbUpAltIcon from "https://esm.sh/@mui/icons-material@9.4.0/ThumbUpAlt?target=es2022";

const theme = createTheme({
    palette: {
        mode: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    },
});

const h = React.createElement;

function ReactionToggle({ selected, label, count, onChange, icon, selectedIcon }) {
    return h(
        ToggleButton,
        {
            value: label.toLowerCase(),
            selected,
            onChange: () => onChange(!selected),
            sx: {
                flex: 1,
                minWidth: 0,
                gap: 0.75,
                textTransform: "none",
            },
        },
        selected ? selectedIcon : icon,
        h(Typography, { variant: "button", component: "span" }, count ? `${label} ${count}` : label),
    );
}

function PostActions({ post }) {
    const [liked, setLiked] = React.useState(Boolean(post.viewer?.liked));
    const [favorited, setFavorited] = React.useState(Boolean(post.viewer?.favorited));
    const [saved, setSaved] = React.useState(Boolean(post.viewer?.saved));

    const toggle = async (kind, current, setter) => {
        try {
            const api = window.imshareUI?.api;
            if (!api) throw new Error("API client is unavailable");
            await api(`/v1/posts/${encodeURIComponent(post.id)}/reactions/${kind}`, {
                method: current ? "DELETE" : "POST",
            });
            setter(!current);
        } catch (error) {
            window.imshareUI?.showSnackbar(
                error instanceof Error ? error.message : "Unable to update reaction.",
                "error",
            );
        }
    };

    return h(
        Stack,
        {
            direction: "row",
            sx: {
                width: "100%",
            },
        },
        h(ReactionToggle, {
            selected: liked,
            label: "Like",
            count: post.reactions?.like,
            onChange: () => toggle("like", liked, setLiked),
            icon: h(ThumbUpAltOutlinedIcon),
            selectedIcon: h(ThumbUpAltIcon),
        }),
        h(ReactionToggle, {
            selected: favorited,
            label: "Favorite",
            count: post.reactions?.favorite,
            onChange: () => toggle("favorite", favorited, setFavorited),
            icon: h(FavoriteBorderIcon),
            selectedIcon: h(FavoriteIcon),
        }),
        h(ReactionToggle, {
            selected: saved,
            label: "Save",
            count: post.reactions?.save,
            onChange: () => toggle("save", saved, setSaved),
            icon: h(BookmarkBorderIcon),
            selectedIcon: h(BookmarkIcon),
        }),
        h(
            Tooltip,
            { title: "More actions" },
            h(
                IconButton,
                {
                    "aria-label": "More actions",
                    sx: { border: 1, borderColor: "divider", borderRadius: 0, px: { xs: 1, sm: 2 } },
                },
                h(MoreVertIcon),
            ),
        ),
    );
}

function LabelChips({ label, items, getId, getName, getHref }) {
    if (!items?.length) return null;

    return h(
        Stack,
        {
            spacing: 0.75,
        },
        h(Typography, { variant: "subtitle2", color: "text.secondary" }, label),
        h(
            Stack,
            {
                direction: "row",
                spacing: 0.75,
                useFlexGap: true,
                sx: { flexWrap: "wrap" },
            },
            ...items.map((item) => {
                const id = getId(item);
                const name = getName(item);
                const href = getHref(id);
                return h(Chip, {
                    key: id || name,
                    label: name,
                    variant: "outlined",
                    component: href ? "a" : "div",
                    href: href || undefined,
                    clickable: Boolean(href),
                });
            }),
        ),
    );
}

function RecommendationSidebar({ posts }) {
    if (!posts?.length) return null;

    return h(
        Stack,
        {
            spacing: 2,
            sx: { position: "sticky", top: 16 },
        },
        h(Typography, { variant: "h6", component: "h2" }, "Recommended"),
        ...posts.slice(0, 5).map((post) => {
            const image = post.uploads?.[0]?.url || null;
            return h(
                Card,
                { key: post.id, variant: "outlined" },
                image
                    ? h(CardMedia, {
                          component: "img",
                          image,
                          alt: post.title || "",
                          sx: { aspectRatio: "4 / 3", objectFit: "cover" },
                      })
                    : null,
                h(
                    CardContent,
                    null,
                    h(Typography, { variant: "subtitle1", component: "h3" }, post.title || "Untitled"),
                    h(Typography, { variant: "body2", color: "text.secondary" }, post.author?.name || post.author?.username || "Unknown author"),
                ),
            );
        }),
    );
}

function PostPage({ post, recommendations = [] }) {
    const author = post.author || {};
    const authorName = post.authorName || author.name || author.username || "Unknown author";
    const profileUrl = author.id ? `/users/${encodeURIComponent(author.id)}` : "/users/";
    const image = post.imageUrl || post.image?.url || post.uploads?.[0]?.url || null;
    const tags = post.tags || [];
    const categories = post.categories || [];

    return h(
        ThemeProvider,
        { theme },
        h(
            Box,
            { sx: { minHeight: "100vh" } },
            h(
                AppBar,
                { position: "static", elevation: 0 },
                h(
                    Toolbar,
                    null,
                    h(
                        IconButton,
                        { color: "inherit", component: "a", href: "/", "aria-label": "Navigation" },
                        h(MenuIcon),
                    ),
                    h(Typography, { variant: "h6", component: "div", sx: { flex: 1 } }, "imshare"),
                    h(
                        IconButton,
                        { color: "inherit", component: "a", href: profileUrl, "aria-label": "Profile" },
                        h(Avatar, { sx: { width: 32, height: 32 } }, authorName.charAt(0).toUpperCase()),
                    ),
                ),
            ),
            h(
                Container,
                {
                    maxWidth: "xl",
                    sx: { py: { xs: 1, md: 3 } },
                },
                h(
                    Box,
                    {
                        sx: {
                            display: { xs: "block", md: "grid" },
                            gridTemplateColumns: "minmax(0, 1fr) 320px",
                            gap: 3,
                        },
                    },
                    h(
                        Box,
                        null,
                        h(
                            Card,
                            { variant: "outlined" },
                            image
                                ? h(CardMedia, {
                                      component: "img",
                                      image,
                                      alt: post.title || "Image",
                                      sx: {
                                          width: "100%",
                                          maxHeight: { xs: "70vh", md: "80vh" },
                                          objectFit: "contain",
                                      },
                                  })
                                : null,
                            post.caption
                                ? h(
                                      CardContent,
                                      null,
                                      h(Typography, { variant: "body1" }, post.caption),
                                  )
                                : null,
                        ),
                        h(
                            Stack,
                            { spacing: 2, sx: { py: 2 } },
                            h(
                                Typography,
                                { variant: "h5", component: "h1" },
                                post.title || "Untitled",
                            ),
                            h(
                                Typography,
                                {
                                    variant: "subtitle1",
                                    component: "a",
                                    href: profileUrl,
                                    color: "text.secondary",
                                    sx: { textDecoration: "none", width: "fit-content" },
                                },
                                `by ${authorName}`,
                            ),
                            h(PostActions, { post }),
                            h(LabelChips, {
                                label: "Tags",
                                items: tags,
                                getId: (item) => item.id || item.tag?.id,
                                getName: (item) => item.name || item.tag?.name,
                                getHref: (id) => id ? `/tags/${encodeURIComponent(id)}` : null,
                            }),
                            h(LabelChips, {
                                label: "Categories",
                                items: categories,
                                getId: (item) => item.id || item.category?.id,
                                getName: (item) => item.name || item.category?.name,
                                getHref: (id) => id ? `/categories/${encodeURIComponent(id)}` : null,
                            }),
                        ),
                    ),
                    h(
                        Box,
                        {
                            sx: {
                                display: { xs: "none", md: "block" },
                            },
                        },
                        h(RecommendationSidebar, { posts: recommendations }),
                    ),
                ),
            ),
        ),
    );
}

export function mountPostPage(root, post, recommendations = []) {
    if (!root) return;
    createRoot(root).render(h(PostPage, { post, recommendations }));
}
