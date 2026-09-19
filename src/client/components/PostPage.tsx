import {
    Alert,
    Avatar,
    Button,
    Card,
    CardContent,
    CardMedia,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Fade,
    FormControl,
    Grow,
    IconButton,
    InputLabel,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LinkIcon from "@mui/icons-material/Link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "./Page";
import { api } from "../lib/api";
import type { Post } from "../lib/types";
import { RecommendationSections } from "./RecommendationSections";

interface Comment {
    id: string;
    body: string;
    createdAt: string;
    liked?: boolean;
    likes?: number;
    author?: {
        id: string;
        name?: string | null;
        username?: string | null;
    } | null;
}

interface CurrentUser {
    id: string;
}

const REPORT_REASONS = [
    ["spam", "Spam"],
    ["copyright", "Copyright"],
    ["harassment", "Harassment"],
    ["illegal", "Illegal content"],
    ["sexual", "Sexual content"],
    ["violence", "Violence"],
    ["other", "Other"],
] as const;

function imageUrl(url: string, width = 1600) {
    const image = new URL(url, window.location.origin);
    image.searchParams.set("width", String(width));
    image.searchParams.set("format", "webp");
    return image.href;
}

function downloadUrl(url: string) {
    const download = new URL(url, window.location.origin);
    download.searchParams.set("download", "true");
    return download.href;
}

function authorUrl(post: Post) {
    return post.author?.id ? `/users/${encodeURIComponent(post.author.id)}/` : undefined;
}

function relativeTime(value: string) {
    const date = new Date(value);
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absoluteSeconds = Math.abs(seconds);
    const units = [
        [31536000, "year"],
        [2592000, "month"],
        [604800, "week"],
        [86400, "day"],
        [3600, "hour"],
        [60, "minute"],
    ] as const;
    for (const [unitSeconds, unit] of units) {
        if (absoluteSeconds >= unitSeconds)
            return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
                Math.round(seconds / unitSeconds),
                unit,
            );
    }
    return "just now";
}

function absoluteTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date(value));
}

function useReducedMotion() {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    return reduced;
}

function PostActions({ post }: { post: Post }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState("");
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number][0]>("other");
    const [reportDetails, setReportDetails] = useState("");
    const [reporting, setReporting] = useState(false);
    const [reportMessage, setReportMessage] = useState("");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        let active = true;
        void api<{ data: CurrentUser }>("/v1/me")
            .then((response) => {
                if (active) setCurrentUserId(response.data.id);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    const toggle = async (kind: "like" | "favorite" | "save") => {
        if (busy) return;
        setBusy(kind);
        try {
            await api(`/v1/posts/${encodeURIComponent(post.id)}/${kind}`, { method: "PUT" });
        } finally {
            setBusy("");
        }
    };

    const openMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const closeMenu = () => setAnchorEl(null);

    const copyLink = async () => {
        closeMenu();
        await navigator.clipboard.writeText(window.location.href);
        setReportMessage(t("postUi.linkCopied"));
    };

    const openReport = () => {
        closeMenu();
        setReportMessage("");
        setReportOpen(true);
    };

    const submitReport = async () => {
        if (reporting) return;
        setReporting(true);
        try {
            await api("/v1/reports", {
                method: "POST",
                body: JSON.stringify({
                    reason: reportReason,
                    details: reportDetails.trim() || undefined,
                    postId: post.id,
                }),
            });
            setReportOpen(false);
            setReportDetails("");
            setReportReason("other");
            setReportMessage(t("postUi.reportSubmitted"));
        } catch (cause) {
            setReportMessage(cause instanceof Error ? cause.message : "Unable to submit report.");
        } finally {
            setReporting(false);
        }
    };

    const deletePost = async () => {
        closeMenu();
        if (!window.confirm(t("postUi.deleteConfirm"))) return;
        setBusy("delete");
        try {
            await api(`/v1/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
            window.location.assign("/posts/");
        } finally {
            setBusy("");
        }
    };

    const buttonSx = (borderLeft = false) => ({
        borderRadius: 0,
        ...(borderLeft ? { borderLeft: 1, borderColor: "divider" } : {}),
        transition: reducedMotion ? "none" : "transform 140ms ease, background-color 140ms ease",
        "&:hover": reducedMotion ? {} : { transform: "translateY(-1px)" },
        "&:active": reducedMotion ? {} : { transform: "scale(0.96)" },
    });

    const ownPost = currentUserId !== null && currentUserId === post.author?.id;

    return (
        <>
            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
                {reportMessage ? (
                    <Alert
                        severity={
                            reportMessage.startsWith("Report submitted") ||
                            reportMessage.startsWith("Link copied")
                                ? "success"
                                : "info"
                        }
                        sx={{ mr: "auto", py: 0 }}
                    >
                        {reportMessage}
                    </Alert>
                ) : null}
                <Stack
                    direction="row"
                    sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}
                >
                    <Tooltip title={t("postUi.like")}>
                        <IconButton
                            aria-label={t("postUi.like")}
                            disabled={busy !== "" && busy !== "like"}
                            onClick={() => void toggle("like")}
                            sx={buttonSx()}
                        >
                            <ThumbUpAltOutlinedIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("postUi.favorite")}>
                        <IconButton
                            aria-label={t("postUi.favorite")}
                            disabled={busy !== "" && busy !== "favorite"}
                            onClick={() => void toggle("favorite")}
                            sx={buttonSx(true)}
                        >
                            <FavoriteBorderIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("postUi.save")}>
                        <IconButton
                            aria-label={t("postUi.save")}
                            disabled={busy !== "" && busy !== "save"}
                            onClick={() => void toggle("save")}
                            sx={buttonSx(true)}
                        >
                            <BookmarkBorderIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t("postUi.moreActions")}>
                        <IconButton
                            aria-label={t("postUi.moreActions")}
                            aria-controls={anchorEl ? "post-actions-menu" : undefined}
                            aria-haspopup="true"
                            aria-expanded={anchorEl ? "true" : undefined}
                            onClick={openMenu}
                            sx={buttonSx(true)}
                        >
                            <MoreVertIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>

            <Menu
                id="post-actions-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={closeMenu}
                transitionDuration={reducedMotion ? 0 : 160}
            >
                {post.allowDownload && post.uploads?.length
                    ? post.uploads.map((upload, index) => (
                          <MenuItem
                              key={`download-${upload.id}`}
                              component="a"
                              href={downloadUrl(upload.url)}
                              download={upload.originalName || undefined}
                              onClick={closeMenu}
                          >
                              <ListItemIcon>
                                  <DownloadIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText>
                                  {post.uploads!.length === 1
                                      ? "Download"
                                      : t("postUi.downloadImage", { number: index + 1 })}
                              </ListItemText>
                          </MenuItem>
                      ))
                    : null}
                <MenuItem onClick={() => void copyLink()}>
                    <ListItemIcon>
                        <LinkIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("postUi.copyLink")}</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        window.open(window.location.href, "_blank", "noopener,noreferrer");
                    }}
                >
                    <ListItemIcon>
                        <OpenInNewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("postUi.openNewTab")}</ListItemText>
                </MenuItem>
                {post.sourceUrl ? (
                    <MenuItem
                        component="a"
                        href={post.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={closeMenu}
                    >
                        <ListItemIcon>
                            <OpenInNewIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{t("postUi.openSource")}</ListItemText>
                    </MenuItem>
                ) : null}
                <Divider />
                {ownPost ? (
                    <>
                        <MenuItem
                            component="a"
                            href={`/dashboard/posts/${encodeURIComponent(post.id)}/edit/`}
                            onClick={closeMenu}
                        >
                            <ListItemIcon>
                                <EditOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t("postUi.edit")}</ListItemText>
                        </MenuItem>
                        <MenuItem disabled={busy === "delete"} onClick={() => void deletePost()}>
                            <ListItemIcon>
                                <DeleteOutlineIcon fontSize="small" color="error" />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ color: "error.main" }}>
                                Delete post
                            </ListItemText>
                        </MenuItem>
                    </>
                ) : null}
                <MenuItem onClick={openReport}>
                    <ListItemIcon>
                        <FlagOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("postUi.report")}</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog
                open={reportOpen}
                onClose={() => !reporting && setReportOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t("postUi.report")}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel id="report-reason-label">{t("postUi.reason")}</InputLabel>
                            <Select
                                labelId="report-reason-label"
                                value={reportReason}
                                label="Reason"
                                onChange={(event) =>
                                    setReportReason(event.target.value as typeof reportReason)
                                }
                            >
                                {REPORT_REASONS.map(([value, label]) => (
                                    <MenuItem key={value} value={value}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            multiline
                            minRows={4}
                            label="Details (optional)"
                            value={reportDetails}
                            onChange={(event) => setReportDetails(event.target.value)}
                            inputProps={{ maxLength: 2000 }}
                            helperText={`${reportDetails.length}/2000`}
                        />
                        {reportMessage && !reportMessage.startsWith("Report submitted") ? (
                            <Alert severity="error">{reportMessage}</Alert>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReportOpen(false)} disabled={reporting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void submitReport()}
                        variant="contained"
                        color="error"
                        disabled={reporting}
                    >
                        {reporting ? <CircularProgress size={18} /> : "Submit report"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

function CommentItem({
    comment,
    currentUser,
    onUpdate,
}: {
    comment: Comment;
    currentUser: CurrentUser | null;
    onUpdate: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const ownComment = currentUser?.id === comment.author?.id;
    const reducedMotion = useReducedMotion();
    const run = async (callback: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        try {
            await callback();
            await onUpdate();
        } finally {
            setBusy(false);
        }
    };
    return (
        <Card
            variant="outlined"
            sx={{
                transition: reducedMotion ? "none" : "transform 160ms ease, box-shadow 160ms ease",
                "&:hover": reducedMotion ? {} : { transform: "translateY(-2px)", boxShadow: 2 },
            }}
        >
            <CardContent>
                <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32 }}>
                            {(comment.author?.name || comment.author?.username || "?")
                                .charAt(0)
                                .toUpperCase()}
                        </Avatar>
                        <Stack>
                            <Typography variant="subtitle2">
                                {comment.author?.name ||
                                    comment.author?.username ||
                                    "Unknown author"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {new Date(comment.createdAt).toLocaleString()}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {comment.body}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            disabled={busy}
                            onClick={() =>
                                run(() =>
                                    api(`/v1/comments/${encodeURIComponent(comment.id)}/like`, {
                                        method: comment.liked ? "DELETE" : "PUT",
                                    }),
                                )
                            }
                        >
                            {comment.likes ? `Like ${comment.likes}` : "Like"}
                        </Button>
                        {ownComment ? (
                            <Button
                                size="small"
                                color="error"
                                disabled={busy}
                                onClick={() => {
                                    if (!window.confirm("Delete this comment?")) return;
                                    void run(() =>
                                        api(`/v1/comments/${encodeURIComponent(comment.id)}`, {
                                            method: "DELETE",
                                        }),
                                    );
                                }}
                            >
                                Delete
                            </Button>
                        ) : null}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function Comments({ postId }: { postId: string }) {
    const { t } = useTranslation();
    const [comments, setComments] = useState<Comment[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const reducedMotion = useReducedMotion();
    const load = useCallback(async () => {
        const response = await api<{ data: Comment[] }>(
            `/v1/posts/${encodeURIComponent(postId)}/comments?limit=100`,
        );
        setComments(response.data || []);
    }, [postId]);
    useEffect(() => {
        let active = true;
        void Promise.all([
            load(),
            api<{ data: CurrentUser }>("/v1/me")
                .then((response) => {
                    if (active) setCurrentUser(response.data);
                })
                .catch(() => {}),
        ])
            .catch((cause) => {
                if (active)
                    setError(cause instanceof Error ? cause.message : "Unable to load comments.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [load]);
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const value = body.trim();
        if (!value || submitting) return;
        setSubmitting(true);
        setError("");
        try {
            await api(`/v1/posts/${encodeURIComponent(postId)}/comments`, {
                method: "POST",
                body: JSON.stringify({ body: value }),
            });
            setBody("");
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to post comment.");
        } finally {
            setSubmitting(false);
        }
    };
    return (
        <Stack spacing={2}>
            <Typography variant="h5" component="h2">
                Comments
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {loading ? (
                <Typography color="text.secondary">Loading comments…</Typography>
            ) : comments.length ? (
                <Stack spacing={1.5}>
                    {comments.map((comment, index) => (
                        <Grow
                            key={comment.id}
                            in
                            timeout={reducedMotion ? 0 : 220 + index * 35}
                            style={{ transformOrigin: "top center" }}
                        >
                            <div>
                                <CommentItem
                                    comment={comment}
                                    currentUser={currentUser}
                                    onUpdate={load}
                                />
                            </div>
                        </Grow>
                    ))}
                </Stack>
            ) : (
                <Typography color="text.secondary">{t("postUi.noComments")}</Typography>
            )}
            <Stack component="form" spacing={1} onSubmit={submit}>
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Add a comment"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    inputProps={{ maxLength: 5000 }}
                />
                <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={submitting || !body.trim()}>
                        {submitting ? "Posting…" : "Post comment"}
                    </Button>
                </Stack>
            </Stack>
        </Stack>
    );
}

export function PostPage({
    postId,
    permalinkKey,
}: {
    postId?: string;
    permalinkKey?: string;
}) {
    const identifier = postId ?? permalinkKey;
    const endpoint = postId
        ? `/v1/posts/${encodeURIComponent(postId)}`
        : `/v1/posts/permalink/${encodeURIComponent(permalinkKey ?? "")}`;
    const [post, setPost] = useState<Post | null>(null);
    const [error, setError] = useState("");
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        let active = true;
        if (!identifier) {
            if (active) setError("Unable to determine post.");
            return;
        }
        void api<{ data: Post }>(endpoint)
            .then((response) => {
                if (!active) return;
                setPost(response.data);
                document.title = `${response.data.title || "Untitled"} · imshare`;
            })
            .catch((cause) => {
                if (active)
                    setError(cause instanceof Error ? cause.message : "Unable to load post.");
            });
        return () => {
            active = false;
        };
    }, [endpoint, identifier]);

    if (error)
        return (
            <Page maxWidth="lg">
                <Fade in timeout={reducedMotion ? 0 : 180}>
                    <div>
                        <Alert severity="error">{error}</Alert>
                        <Button component="a" href="/posts/" sx={{ mt: 2 }}>
                            Back to posts
                        </Button>
                    </div>
                </Fade>
            </Page>
        );
    if (!post)
        return (
            <Page maxWidth="lg">
                <Fade in timeout={reducedMotion ? 0 : 180}>
                    <div>
                        <Typography color="text.secondary">Loading post…</Typography>
                    </div>
                </Fade>
            </Page>
        );

    const authorName = post.author?.name || post.authorName || post.author?.id || "Unknown author";
    const authorHref = authorUrl(post);
    const authorAvatar = post.author?.avatarUrl || post.author?.image || undefined;
    const authorInitial = authorName.charAt(0).toUpperCase() || "?";
    const authorMetadata = authorHref ? (
        <Stack
            key="user"
            component="a"
            href={authorHref}
            direction="row"
            spacing={1}
            alignItems="center"
            color="text.secondary"
            sx={{ width: "fit-content", textDecoration: "none" }}
        >
            <Avatar
                src={authorAvatar}
                alt={authorName}
                sx={{ width: 28, height: 28, fontSize: "0.8rem" }}
            >
                {authorInitial}
            </Avatar>
            <Typography component="span" color="inherit">
                {authorName}
            </Typography>
        </Stack>
    ) : (
        <Stack key="user" direction="row" spacing={1} alignItems="center" color="text.secondary">
            <Avatar
                src={authorAvatar}
                alt={authorName}
                sx={{ width: 28, height: 28, fontSize: "0.8rem" }}
            >
                {authorInitial}
            </Avatar>
            <Typography component="span" color="inherit">
                {authorName}
            </Typography>
        </Stack>
    );
    const metadata = [
        authorMetadata,
        <Typography key="views" component="span" color="text.secondary">
            {post.viewCount ?? 0} views
        </Typography>,
        ...(post.createdAt
            ? [
                  <Tooltip key="created" title={`Created ${absoluteTime(post.createdAt)}`}>
                      <Typography
                          component="time"
                          dateTime={post.createdAt}
                          color="text.secondary"
                          sx={{ cursor: "help" }}
                      >
                          {relativeTime(post.createdAt)}
                      </Typography>
                  </Tooltip>,
              ]
            : []),
        ...(post.updatedAt && post.updatedAt !== post.createdAt
            ? [
                  <Tooltip key="updated" title={`Updated ${absoluteTime(post.updatedAt)}`}>
                      <Typography
                          component="time"
                          dateTime={post.updatedAt}
                          color="text.secondary"
                          sx={{ cursor: "help" }}
                      >
                          updated {relativeTime(post.updatedAt)}
                      </Typography>
                  </Tooltip>,
              ]
            : []),
    ];
    const cardSx = {
        transition: reducedMotion ? "none" : "transform 180ms ease, box-shadow 180ms ease",
        "&:hover": reducedMotion ? {} : { transform: "translateY(-2px)", boxShadow: 2 },
    };

    return (
        <Page maxWidth="lg">
            <Stack spacing={{ xs: 2, sm: 3 }}>
                <Stack
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "minmax(0, 1fr)",
                            lg: "minmax(0, 1fr) minmax(300px, 360px)",
                        },
                        alignItems: "start",
                        gap: { xs: 2, sm: 3, lg: 4 },
                    }}
                >
                    <Stack spacing={{ xs: 2, sm: 3 }}>
                        <Fade in timeout={reducedMotion ? 0 : 260}>
                            <div>
                                <Stack spacing={{ xs: 1, sm: 1.5 }}>
                                    {post.uploads?.map((upload, index) => (
                                        <Grow
                                            key={upload.id}
                                            in
                                            timeout={reducedMotion ? 0 : 220 + index * 45}
                                            style={{ transformOrigin: "center top" }}
                                        >
                                            <div>
                                                <Card
                                                    variant="outlined"
                                                    sx={{ ...cardSx, overflow: "hidden" }}
                                                >
                                                    <CardMedia
                                                        component="img"
                                                        image={imageUrl(upload.url)}
                                                        alt={upload.alt || post.title || ""}
                                                        sx={{
                                                            maxHeight: "80vh",
                                                            objectFit: "contain",
                                                        }}
                                                    />
                                                    {upload.alt ? (
                                                        <CardContent>
                                                            <Typography color="text.secondary">
                                                                {upload.alt}
                                                            </Typography>
                                                        </CardContent>
                                                    ) : null}
                                                </Card>
                                            </div>
                                        </Grow>
                                    ))}
                                </Stack>
                            </div>
                        </Fade>

                        <Divider />

                        <Fade
                            in
                            timeout={reducedMotion ? 0 : 320}
                            style={{ transitionDelay: reducedMotion ? "0ms" : "80ms" }}
                        >
                            <div>
                                <Card variant="outlined" sx={cardSx}>
                                    <CardContent>
                                        <Stack spacing={2}>
                                            <Stack spacing={0.5}>
                                                <Typography variant="h3" component="h1">
                                                    {post.title || "Untitled"}
                                                </Typography>
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    useFlexGap
                                                    flexWrap="wrap"
                                                    divider={
                                                        <Typography color="text.disabled">
                                                            ・
                                                        </Typography>
                                                    }
                                                >
                                                    {metadata}
                                                </Stack>
                                            </Stack>
                                            <PostActions post={post} />
                                            {post.originalCreator || post.originalCreatedAt ? (
                                                <>
                                                    <Divider />
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="subtitle2">
                                                            Original content
                                                        </Typography>
                                                        {post.originalCreator ? (
                                                            <Typography color="text.secondary">
                                                                Original creator:{" "}
                                                                {post.originalCreator}
                                                            </Typography>
                                                        ) : null}
                                                        {post.originalCreatedAt ? (
                                                            <Typography
                                                                component="time"
                                                                dateTime={post.originalCreatedAt}
                                                                color="text.secondary"
                                                            >
                                                                Original creation date:{" "}
                                                                {absoluteTime(
                                                                    post.originalCreatedAt,
                                                                )}
                                                            </Typography>
                                                        ) : null}
                                                    </Stack>
                                                </>
                                            ) : null}
                                            {post.description ? (
                                                <>
                                                    <Divider />
                                                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                                                        {post.description}
                                                    </Typography>
                                                </>
                                            ) : null}
                                            {post.tags?.length || post.categories?.length ? (
                                                <>
                                                    <Divider />
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        useFlexGap
                                                        flexWrap="wrap"
                                                    >
                                                        {post.tags?.map((tag) => {
                                                            const id = tag.id || tag.tag?.id;
                                                            const name = tag.name || tag.tag?.name;
                                                            return id && name ? (
                                                                <Chip
                                                                    key={`tag-${id}`}
                                                                    label={name}
                                                                    component="a"
                                                                    href={`/tags/${encodeURIComponent(id)}/`}
                                                                    clickable
                                                                />
                                                            ) : null;
                                                        })}
                                                        {post.categories?.map((category) => {
                                                            const id =
                                                                category.id ||
                                                                category.category?.id;
                                                            const name =
                                                                category.name ||
                                                                category.category?.name;
                                                            return id && name ? (
                                                                <Chip
                                                                    key={`category-${id}`}
                                                                    label={name}
                                                                    component="a"
                                                                    href={`/categories/${encodeURIComponent(id)}/`}
                                                                    clickable
                                                                />
                                                            ) : null;
                                                        })}
                                                    </Stack>
                                                </>
                                            ) : null}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </div>
                        </Fade>

                        <Fade
                            in
                            timeout={reducedMotion ? 0 : 320}
                            style={{ transitionDelay: reducedMotion ? "0ms" : "140ms" }}
                        >
                            <div>
                                <Card variant="outlined" sx={cardSx}>
                                    <CardContent>
                                        <Comments postId={post.id} />
                                    </CardContent>
                                </Card>
                            </div>
                        </Fade>
                    </Stack>

                    <Stack
                        sx={{
                            minWidth: 0,
                            position: { xs: "static", lg: "sticky" },
                            top: { lg: 88 },
                        }}
                    >
                        <RecommendationSections postId={post.id} />
                    </Stack>
                </Stack>
            </Stack>
        </Page>
    );
}
