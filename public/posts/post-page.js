import React from "https://esm.sh/react@19.1.1?target=es2022";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client?target=es2022";
import {
    Alert,
    AppBar,
    Avatar,
    Box,
    Button,
    ButtonGroup,
    Card,
    CardContent,
    CardMedia,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogContent,
    Divider,
    IconButton,
    Link,
    Stack,
    TextField,
    ThemeProvider,
    Toolbar,
    Tooltip,
    Typography,
    createTheme,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import ArrowBackIcon from "https://esm.sh/@mui/icons-material@9.4.0/ArrowBack?target=es2022";
import ArrowForwardIcon from "https://esm.sh/@mui/icons-material@9.4.0/ArrowForward?target=es2022";
import BookmarkBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/BookmarkBorder?target=es2022";
import BookmarkIcon from "https://esm.sh/@mui/icons-material@9.4.0/Bookmark?target=es2022";
import CloseIcon from "https://esm.sh/@mui/icons-material@9.4.0/Close?target=es2022";
import ContentCopyIcon from "https://esm.sh/@mui/icons-material@9.4.0/ContentCopy?target=es2022";
import DeleteOutlineIcon from "https://esm.sh/@mui/icons-material@9.4.0/DeleteOutline?target=es2022";
import FavoriteBorderIcon from "https://esm.sh/@mui/icons-material@9.4.0/FavoriteBorder?target=es2022";
import FavoriteIcon from "https://esm.sh/@mui/icons-material@9.4.0/Favorite?target=es2022";
import FileDownloadOutlinedIcon from "https://esm.sh/@mui/icons-material@9.4.0/FileDownloadOutlined?target=es2022";
import MenuIcon from "https://esm.sh/@mui/icons-material@9.4.0/Menu?target=es2022";
import MoreVertIcon from "https://esm.sh/@mui/icons-material@9.4.0/MoreVert?target=es2022";
import ReportOutlinedIcon from "https://esm.sh/@mui/icons-material@9.4.0/ReportOutlined?target=es2022";
import ThumbUpAltIcon from "https://esm.sh/@mui/icons-material@9.4.0/ThumbUpAlt?target=es2022";
import ThumbUpAltOutlinedIcon from "https://esm.sh/@mui/icons-material@9.4.0/ThumbUpAltOutlined?target=es2022";

const h = React.createElement;
const theme = createTheme({
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

function api() {
    const client = window.imshareUI?.api;
    if (!client) throw new Error("API client is unavailable.");
    return client;
}

function notify(message, severity = "info") {
    if (window.imshareUI?.showSnackbar) window.imshareUI.showSnackbar(message, severity);
}

function uploadUrl(upload, width = 1600) {
    return `${upload.url}?width=${width}&format=webp`;
}

function getAuthorName(post) {
    return post.authorName || post.author?.name || post.author?.username || "Unknown author";
}

function ReactionActions({ post, reactions, onRefresh }) {
    const [busy, setBusy] = React.useState("");

    const toggle = async (kind) => {
        if (busy) return;
        const active = Boolean(reactions.active?.[kind]);
        setBusy(kind);
        try {
            await api()(`/v1/posts/${encodeURIComponent(post.id)}/${kind}`, {
                method: active ? "DELETE" : "PUT",
            });
            await onRefresh();
        } catch (error) {
            notify(error instanceof Error ? error.message : "Unable to update reaction.", "error");
        } finally {
            setBusy("");
        }
    };

    const action = (kind, label, selectedIcon, icon) =>
        h(
            Button,
            {
                disabled: busy !== "" && busy !== kind,
                startIcon: reactions.active?.[kind] ? selectedIcon : icon,
                onClick: () => toggle(kind),
                sx: { minWidth: 0, flex: 1 },
            },
            reactions.counts?.[kind] ? `${label} ${reactions.counts[kind]}` : label,
        );

    return h(
        ButtonGroup,
        {
            fullWidth: true,
            variant: "outlined",
            sx: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)" },
        },
        action("like", "Like", h(ThumbUpAltIcon), h(ThumbUpAltOutlinedIcon)),
        action("favorite", "Favorite", h(FavoriteIcon), h(FavoriteBorderIcon)),
        action("save", "Save", h(BookmarkIcon), h(BookmarkBorderIcon)),
        h(
            Tooltip,
            { title: "More actions" },
            h(IconButton, { "aria-label": "More actions" }, h(MoreVertIcon)),
        ),
    );
}

function MetadataChips({ label, items, href }) {
    if (!items?.length) return null;
    return h(
        Stack,
        { spacing: 0.75 },
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
                const id = item.id || item.tag?.id || item.category?.id || item.name;
                const name = item.name || item.tag?.name || item.category?.name || "Unnamed";
                return h(Chip, {
                    key: id,
                    label: name,
                    variant: "outlined",
                    clickable: Boolean(href && id),
                    component: href && id ? "a" : "div",
                    href: href && id ? href(id) : undefined,
                });
            }),
        ),
    );
}

function ImageViewer({ uploads, index, open, onClose }) {
    const [currentIndex, setCurrentIndex] = React.useState(index);
    React.useEffect(() => {
        setCurrentIndex(index);
    }, [index]);
    const upload = uploads?.[currentIndex];
    if (!upload) return null;

    const move = (delta) => {
        setCurrentIndex((value) => (value + delta + uploads.length) % uploads.length);
    };

    return h(
        Dialog,
        { open, onClose, fullScreen: true, PaperProps: { sx: { bgcolor: "background.default" } } },
        h(
            DialogContent,
            {
                sx: {
                    display: "grid",
                    gridTemplateRows: "auto minmax(0, 1fr) auto",
                    gap: 1,
                    p: 1,
                },
            },
            h(
                Stack,
                { direction: "row", justifyContent: "space-between", alignItems: "center" },
                h(Typography, { variant: "body2", color: "text.secondary", sx: { px: 1 } }, `${currentIndex + 1} / ${uploads.length}`),
                h(IconButton, { onClick: onClose, "aria-label": "Close viewer" }, h(CloseIcon)),
            ),
            h(
                Box,
                {
                    sx: {
                        minHeight: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    },
                },
                h("img", {
                    src: uploadUrl(upload, 2400),
                    alt: upload.alt || "Image",
                    style: {
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                    },
                }),
            ),
            h(
                Stack,
                { direction: "row", justifyContent: "center", spacing: 1 },
                h(IconButton, { onClick: () => move(-1), disabled: uploads.length < 2, "aria-label": "Previous image" }, h(ArrowBackIcon)),
                h(IconButton, { onClick: () => move(1), disabled: uploads.length < 2, "aria-label": "Next image" }, h(ArrowForwardIcon)),
            ),
        ),
    );
}

function CommentCard({ comment, currentUser, onUpdate }) {
    const [busy, setBusy] = React.useState(false);

    const run = async (callback) => {
        if (busy) return;
        setBusy(true);
        try {
            await callback();
            await onUpdate();
        } catch (error) {
            notify(error instanceof Error ? error.message : "Unable to update comment.", "error");
        } finally {
            setBusy(false);
        }
    };

    const ownComment = currentUser?.id === comment.author?.id;
    const ownerComment = currentUser?.id === window.__postOwner;

    return h(
        Card,
        { variant: "outlined" },
        h(
            CardContent,
            null,
            h(
                Stack,
                { direction: "row", spacing: 1, alignItems: "center", sx: { mb: 1 } },
                h(Avatar, { sx: { width: 32, height: 32 } }, (comment.author?.name || "?").charAt(0).toUpperCase()),
                h(
                    Box,
                    { sx: { minWidth: 0, flex: 1 } },
                    h(Typography, { variant: "subtitle2" }, comment.author?.name || "Unknown author"),
                    h(Typography, { variant: "caption", color: "text.secondary" }, new Date(comment.createdAt).toLocaleString()),
                ),
            ),
            h(Typography, { sx: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, comment.body),
            h(
                Stack,
                { direction: "row", spacing: 1, sx: { mt: 1 } },
                h(
                    Button,
                    {
                        size: "small",
                        disabled: busy,
                        onClick: () => run(() => api()(`/v1/comments/${encodeURIComponent(comment.id)}/like`, { method: comment.liked ? "DELETE" : "PUT" })),
                        startIcon: comment.liked ? h(ThumbUpAltIcon) : h(ThumbUpAltOutlinedIcon),
                    },
                    comment.likes ? `Like ${comment.likes}` : "Like",
                ),
                ownComment
                    ? h(
                          Button,
                          {
                              size: "small",
                              disabled: busy,
                              onClick: () => {
                                  const body = window.prompt("Edit comment", comment.body);
                                  if (body === null) return;
                                  return run(() => api()(`/v1/comments/${encodeURIComponent(comment.id)}`, {
                                      method: "PATCH",
                                      body: JSON.stringify({ body }),
                                  }));
                              },
                          },
                          "Edit",
                      )
                    : null,
                ownComment || ownerComment
                    ? h(
                          Button,
                          {
                              size: "small",
                              color: "error",
                              disabled: busy,
                              startIcon: h(DeleteOutlineIcon),
                              onClick: () => {
                                  if (!window.confirm("Delete this comment?")) return;
                                  return run(() => api()(`/v1/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" }));
                              },
                          },
                          "Delete",
                      )
                    : null,
                h(
                    Button,
                    {
                        size: "small",
                        disabled: busy,
                        startIcon: h(ReportOutlinedIcon),
                        onClick: () => {
                            const reason = window.prompt("Report reason", "other");
                            if (!reason) return;
                            return run(() => api()("/v1/reports", {
                                method: "POST",
                                body: JSON.stringify({ commentId: comment.id, reason }),
                            }));
                        },
                    },
                    "Report",
                ),
            ),
        ),
    );
}

function Comments({ postId, currentUser }) {
    const [comments, setComments] = React.useState([]);
    const [status, setStatus] = React.useState("loading");
    const [body, setBody] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);

    const load = React.useCallback(async () => {
        const response = await api()(`/v1/posts/${encodeURIComponent(postId)}/comments?limit=100`);
        setComments(response.data || []);
    }, [postId]);

    React.useEffect(() => {
        load().then(() => setStatus("ready")).catch(() => setStatus("error"));
    }, [load]);

    const submit = async (event) => {
        event.preventDefault();
        if (!body.trim() || submitting) return;
        setSubmitting(true);
        try {
            await api()(`/v1/posts/${encodeURIComponent(postId)}/comments`, {
                method: "POST",
                body: JSON.stringify({ body: body.trim() }),
            });
            setBody("");
            await load();
        } catch (error) {
            notify(error instanceof Error ? error.message : "Unable to post comment.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return h(
        Stack,
        { spacing: 2 },
        h(Typography, { variant: "h6", component: "h2" }, "Comments"),
        status === "loading"
            ? h(Stack, { alignItems: "center", sx: { py: 3 } }, h(CircularProgress, { size: 24 }))
            : status === "error"
              ? h(Alert, { severity: "error" }, "Unable to load comments.")
              : comments.length
                ? h(Stack, { spacing: 1 }, ...comments.map((comment) => h(CommentCard, { key: comment.id, comment, currentUser, onUpdate: load })))
                : h(Typography, { color: "text.secondary" }, "No comments yet."),
        h(
            Box,
            { component: "form", onSubmit: submit },
            h(Stack, { spacing: 1 },
                h(TextField, {
                    fullWidth: true,
                    multiline: true,
                    minRows: 3,
                    maxRows: 10,
                    label: "Add a comment",
                    value: body,
                    onChange: (event) => setBody(event.target.value),
                    inputProps: { maxLength: 5000 },
                }),
                h(Stack, { direction: "row", justifyContent: "flex-end" },
                    h(Button, { type: "submit", variant: "contained", disabled: submitting || !body.trim() }, submitting ? "Posting…" : "Post comment"),
                ),
            ),
        ),
    );
}

function RecommendationCard({ post }) {
    const upload = post.uploads?.[0];
    return h(
        Card,
        { variant: "outlined", sx: { overflow: "hidden" } },
        upload
            ? h(CardMedia, {
                  component: "img",
                  image: uploadUrl(upload, 480),
                  alt: post.title || "",
                  loading: "lazy",
                  sx: { aspectRatio: "4 / 3", objectFit: "cover" },
              })
            : null,
        h(
            CardContent,
            null,
            h(
                Link,
                {
                    href: `/posts/${encodeURIComponent(post.id)}`,
                    underline: "hover",
                    color: "inherit",
                    fontWeight: 600,
                    display: "block",
                },
                post.title || "Untitled",
            ),
            h(Typography, { variant: "body2", color: "text.secondary", sx: { mt: 0.5 } }, getAuthorName(post)),
        ),
    );
}

function PostHeader({ post }) {
    const authorName = getAuthorName(post);
    const profileUrl = post.author?.id ? `/users/${encodeURIComponent(post.author.id)}` : "/users/";
    return h(
        AppBar,
        { position: "static", elevation: 0 },
        h(
            Toolbar,
            { sx: { maxWidth: 1440, width: "100%", mx: "auto" } },
            h(IconButton, { color: "inherit", component: "a", href: "/", "aria-label": "Home" }, h(MenuIcon)),
            h(Typography, { variant: "h6", component: "a", href: "/", color: "inherit", sx: { flex: 1, textDecoration: "none" } }, "imshare"),
            h(
                IconButton,
                { color: "inherit", component: "a", href: profileUrl, "aria-label": "Profile" },
                h(Avatar, { sx: { width: 32, height: 32 } }, authorName.charAt(0).toUpperCase()),
            ),
        ),
    );
}

function PostPage({ post, currentUser, recommendations }) {
    const uploads = (post.uploads || []).map((upload) => ({ ...upload, alt: post.caption || post.title || upload.originalName }));
    const authorName = getAuthorName(post);
    const profileUrl = post.author?.id ? `/users/${encodeURIComponent(post.author.id)}` : "/users/";
    const [viewerOpen, setViewerOpen] = React.useState(false);
    const [viewerIndex, setViewerIndex] = React.useState(0);
    const [reactions, setReactions] = React.useState({ counts: {}, active: {} });
    const [reactionLoading, setReactionLoading] = React.useState(true);

    const loadReactions = React.useCallback(async () => {
        setReactionLoading(true);
        try {
            const response = await api()(`/v1/posts/${encodeURIComponent(post.id)}/reactions`);
            setReactions(response.data || { counts: {}, active: {} });
        } catch (error) {
            notify(error instanceof Error ? error.message : "Unable to load reactions.", "error");
        } finally {
            setReactionLoading(false);
        }
    }, [post.id]);

    React.useEffect(() => {
        loadReactions();
    }, [loadReactions]);

    React.useEffect(() => {
        const socket = window.io?.();
        if (!socket) return undefined;
        socket.emit("post:subscribe", post.id);
        const handler = (event) => {
            if (event.postId !== post.id) return;
            setReactions((value) => ({ ...value, counts: event.counts || value.counts }));
        };
        socket.on("post:reaction", handler);
        return () => {
            socket.off("post:reaction", handler);
            socket.disconnect();
        };
    }, [post.id]);

    const copyImageUrl = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            notify("Image URL copied.", "success");
        } catch {
            notify("Unable to copy image URL.", "error");
        }
    };

    const reportPost = async () => {
        const reason = window.prompt("Report reason", "other");
        if (!reason) return;
        try {
            await api()("/v1/reports", {
                method: "POST",
                body: JSON.stringify({ postId: post.id, reason }),
            });
            notify("Report submitted.", "success");
        } catch (error) {
            notify(error instanceof Error ? error.message : "Unable to submit report.", "error");
        }
    };

    return h(
        ThemeProvider,
        { theme },
        h(
            Box,
            { sx: { minHeight: "100vh", bgcolor: "background.default" } },
            h(PostHeader, { post }),
            h(
                Container,
                { maxWidth: "xl", sx: { py: { xs: 1, md: 3 } } },
                h(
                    Box,
                    {
                        sx: {
                            display: { xs: "block", md: "grid" },
                            gridTemplateColumns: "minmax(0, 1fr) 320px",
                            gap: 3,
                            alignItems: "start",
                        },
                    },
                    h(
                        Stack,
                        { spacing: 2 },
                        uploads.length
                            ? h(
                                  Card,
                                  { variant: "outlined", sx: { overflow: "hidden" } },
                                  h(
                                      Stack,
                                      { spacing: 0 },
                                      ...uploads.map((upload, index) =>
                                          h(
                                              Box,
                                              {
                                                  key: upload.id || index,
                                                  sx: {
                                                      display: "flex",
                                                      justifyContent: "center",
                                                      bgcolor: "black",
                                                      cursor: "zoom-in",
                                                  },
                                                  onClick: () => {
                                                      setViewerIndex(index);
                                                      setViewerOpen(true);
                                                  },
                                              },
                                              h("img", {
                                                  src: uploadUrl(upload, 1600),
                                                  alt: upload.alt,
                                                  loading: index === 0 ? "eager" : "lazy",
                                                  decoding: "async",
                                                  style: {
                                                      display: "block",
                                                      width: "min(100%, 45vw)",
                                                      maxHeight: "80vh",
                                                      objectFit: "contain",
                                                  },
                                              }),
                                          ),
                                      ),
                                  ),
                                  h(
                                      CardContent,
                                      null,
                                      h(
                                          Stack,
                                          { direction: "row", spacing: 1, useFlexGap: true, sx: { flexWrap: "wrap" } },
                                          ...uploads.map((upload, index) =>
                                              h(
                                                  Button,
                                                  {
                                                      key: upload.id || index,
                                                      size: "small",
                                                      variant: "outlined",
                                                      onClick: () => {
                                                          setViewerIndex(index);
                                                          setViewerOpen(true);
                                                      },
                                                  },
                                                  `Image ${index + 1}`,
                                              ),
                                          ),
                                      ),
                                  ),
                              )
                            : h(Alert, { severity: "info" }, "This post has no images."),
                        h(
                            Stack,
                            { spacing: 1.5 },
                            h(Typography, { variant: "h4", component: "h1", sx: { overflowWrap: "anywhere" } }, post.title || "Untitled"),
                            h(
                                Typography,
                                { component: "a", href: profileUrl, color: "text.secondary", sx: { textDecoration: "none", width: "fit-content" } },
                                `by ${authorName}`,
                            ),
                            reactionLoading
                                ? h(Stack, { alignItems: "center", sx: { py: 1 } }, h(CircularProgress, { size: 24 }))
                                : h(ReactionActions, { post, reactions, onRefresh: loadReactions }),
                            post.caption ? h(Typography, { variant: "body1", sx: { whiteSpace: "pre-wrap" } }, post.caption) : null,
                            post.description ? h(Typography, { variant: "body2", color: "text.secondary", sx: { whiteSpace: "pre-wrap" } }, post.description) : null,
                            h(MetadataChips, {
                                label: "Tags",
                                items: post.tags,
                                href: (id) => `/tags/${encodeURIComponent(id)}`,
                            }),
                            h(MetadataChips, {
                                label: "Categories",
                                items: post.categories || (post.category ? [post.category] : []),
                                href: (id) => `/categories/${encodeURIComponent(id)}`,
                            }),
                            post.sourceUrl
                                ? h(Typography, { variant: "body2" }, "Source: ", h(Link, { href: post.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, post.sourceUrl))
                                : null,
                            h(Divider, null),
                            h(
                                Stack,
                                { direction: "row", spacing: 1, useFlexGap: true, sx: { flexWrap: "wrap" } },
                                post.allowDownload && uploads.length
                                    ? uploads.map((upload, index) =>
                                          h(
                                              React.Fragment,
                                              { key: upload.id || index },
                                              h(
                                                  Button,
                                                  {
                                                      component: "a",
                                                      href: `${upload.url}?download=true`,
                                                      startIcon: h(FileDownloadOutlinedIcon),
                                                      target: "_blank",
                                                      rel: "noopener noreferrer",
                                                  },
                                                  `Download ${uploads.length > 1 ? index + 1 : "original"}`,
                                              ),
                                              h(
                                                  Button,
                                                  {
                                                      onClick: () => copyImageUrl(upload.url),
                                                      startIcon: h(ContentCopyIcon),
                                                  },
                                                  "Copy URL",
                                              ),
                                          ),
                                      )
                                    : null,
                                h(
                                    Button,
                                    { color: "error", onClick: reportPost, startIcon: h(ReportOutlinedIcon) },
                                    "Report",
                                ),
                            ),
                        ),
                        h(Divider, null),
                        h(Comments, { postId: post.id, currentUser }),
                    ),
                    h(
                        Box,
                        { sx: { display: { xs: "none", md: "block" } } },
                        recommendations?.length
                            ? h(
                                  Stack,
                                  { spacing: 2, sx: { position: "sticky", top: 16 } },
                                  h(Typography, { variant: "h6", component: "h2" }, "Recommended"),
                                  ...recommendations.slice(0, 5).map((recommendation) => h(RecommendationCard, { key: recommendation.id, post: recommendation })),
                              )
                            : null,
                    ),
                ),
            ),
            h(ImageViewer, {
                uploads,
                index: viewerIndex,
                open: viewerOpen,
                onClose: () => setViewerOpen(false),
            }),
        ),
    );
}

export async function mountPostPage(root, postId) {
    if (!root) return;
    root.textContent = "";
    try {
        const [{ data: post }, currentUser, recommendationResult] = await Promise.all([
            api()(`/v1/posts/${encodeURIComponent(postId)}`),
            api()("/v1/me").then((response) => response.data).catch(() => null),
            api()("/v1/recommendations?limit=6").catch(() => ({ data: [] })),
        ]);
        window.__postOwner = post.author?.id;
        document.title = `${post.title || "Untitled"} · imshare`;
        createRoot(root).render(
            h(PostPage, {
                post,
                currentUser,
                recommendations: recommendationResult.data || [],
            }),
        );
    } catch (error) {
        createRoot(root).render(
            h(
                ThemeProvider,
                { theme },
                h(
                    Container,
                    { maxWidth: "sm", sx: { py: 6 } },
                    h(Alert, { severity: "error" }, error instanceof Error ? error.message : "Unable to load post."),
                    h(Button, { component: "a", href: "/posts/", sx: { mt: 2 } }, "Back to posts"),
                ),
            ),
        );
    }
}
