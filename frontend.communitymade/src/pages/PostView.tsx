import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  CardMedia,
  TextField,
  Button,
  Box,
  Chip,
  IconButton,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from "@mui/material";
import {
  ThumbUp as ThumbUpIcon,
  Star as StarIcon,
  Bookmark as BookmarkIcon,
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Flag as FlagIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Send as SendIcon,
  ChatBubble as CommentIcon,
} from "@mui/icons-material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { api } from "../api";

interface Author {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Upload {
  id: string;
  url: string;
  thumbhash?: string;
  originalName?: string;
}

interface Post {
  id: string;
  title: string;
  caption?: string;
  description?: string;
  sourceUrl?: string;
  allowDownload?: boolean;
  author: Author;
  uploads: Upload[];
  tags: { id: string; name: string }[];
  category?: { id: string; name: string };
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  author: Author;
  createdAt: string;
  updatedAt: string;
  likes: number;
  liked: boolean;
}

interface ReactionState {
  counts: { like: number; favorite: number; save: number };
  active: { like: boolean; favorite: boolean; save: boolean };
}

export default function PostView() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [currentUser, setCurrentUser] = useState<Author | null>(null);
  const [reactions, setReactions] = useState<ReactionState>({
    counts: { like: 0, favorite: 0, save: 0 },
    active: { like: false, favorite: false, save: false },
  });
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("other");
  const [reportTarget, setReportTarget] = useState<{ postId?: string; commentId?: string }>({});

  const id = decodeURIComponent(postId || "");

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, meRes]: any[] = await Promise.all([
          api(`/v1/posts/${encodeURIComponent(id)}`),
          api("/v1/me").catch(() => ({ data: null })),
        ]);
        setPost(postRes.data);
        setCurrentUser(meRes.data);
        loadComments();
        loadReactions();
      } catch {
        setError("Post not found");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const loadComments = async () => {
    try {
      const r: any = await api(
        `/v1/posts/${encodeURIComponent(id)}/comments?limit=100`
      );
      setComments(r.data);
    } catch {}
  };

  const loadReactions = async () => {
    try {
      const r: any = await api(
        `/v1/posts/${encodeURIComponent(id)}/reactions`
      );
      setReactions(r.data);
    } catch {}
  };

  const toggleReaction = async (type: "like" | "favorite" | "save") => {
    try {
      const active = reactions.active[type];
      const r: any = await api(
        `/v1/posts/${encodeURIComponent(id)}/${type}`,
        { method: active ? "DELETE" : "PUT" }
      );
      setReactions(r.data);
    } catch {
      alert("Please sign in to react to posts.");
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentStatus("");
    try {
      await api(`/v1/posts/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentText }),
      });
      setCommentText("");
      setCommentStatus("Comment posted.");
      loadComments();
    } catch (e: any) {
      setCommentStatus(e.status === 401 ? "Please sign in to comment." : e.message);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    try {
      const c = comments.find((x) => x.id === commentId);
      if (!c) return;
      await api(`/v1/comments/${encodeURIComponent(commentId)}/like`, {
        method: c.liked ? "DELETE" : "PUT",
      });
      loadComments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await api(`/v1/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
      loadComments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openReport = (target: { postId?: string; commentId?: string }) => {
    setReportTarget(target);
    setReportReason("other");
    setReportDialogOpen(true);
  };

  const submitReport = async () => {
    try {
      await api("/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reportTarget.commentId
            ? { commentId: reportTarget.commentId, reason: reportReason }
            : { postId: reportTarget.postId, reason: reportReason }
        ),
      });
      setReportDialogOpen(false);
      alert("Report submitted.");
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" height={40} width="60%" />
        <Skeleton variant="rectangular" height={400} sx={{ my: 2 }} />
        <Skeleton variant="text" width="40%" />
      </Card>
    );
  }

  if (error || !post) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h5">Post not found</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          That post does not exist or could not be loaded.
        </Typography>
        <Button
          component={RouterLink}
          to="/posts/"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to posts
        </Button>
      </Card>
    );
  }

  const reactionButtons = [
    { type: "like" as const, icon: <ThumbUpIcon />, label: "Like" },
    { type: "favorite" as const, icon: <StarIcon />, label: "Favorite" },
    { type: "save" as const, icon: <BookmarkIcon />, label: "Save" },
  ];

  return (
    <>
      <Button
        component={RouterLink}
        to="/posts/"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to posts
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            {post.title}
          </Typography>

          {post.uploads?.map((upload) => (
            <Box key={upload.id} sx={{ mb: 2, textAlign: "center" }}>
              <CardMedia
                component="img"
                image={`${upload.url}?width=1600&format=webp`}
                alt={post.caption || post.title || upload.originalName}
                sx={{
                  maxWidth: "100%",
                  maxHeight: "85vh",
                  mx: "auto",
                  borderRadius: 1,
                }}
              />
              {post.allowDownload && (
                <Button
                  href={`${upload.url}?download=true`}
                  startIcon={<DownloadIcon />}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Download original
                </Button>
              )}
            </Box>
          ))}

          {post.caption && (
            <Typography sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
              {post.caption}
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 1, my: 2, flexWrap: "wrap" }}>
            {reactionButtons.map(({ type, icon, label }) => (
              <Button
                key={type}
                variant={reactions.active[type] ? "contained" : "outlined"}
                startIcon={icon}
                onClick={() => toggleReaction(type)}
                size="small"
              >
                {label} ({reactions.counts[type] || 0})
              </Button>
            ))}
          </Box>

          {post.description && (
            <Typography sx={{ mb: 1 }}>{post.description}</Typography>
          )}

          <Typography color="text.secondary" sx={{ mb: 1 }}>
            by{" "}
            <RouterLink to={`/users/${encodeURIComponent(post.author.id)}`}>
              {post.author.name}
            </RouterLink>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Created: {new Date(post.createdAt).toLocaleString()}
          </Typography>

          {post.category && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Category:{" "}
              <RouterLink to={`/categories/${encodeURIComponent(post.category.id)}`}>
                {post.category.name}
              </RouterLink>
            </Typography>
          )}

          {post.tags.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
              {post.tags.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  component={RouterLink}
                  to={`/tags/${encodeURIComponent(t.id)}`}
                  clickable
                  size="small"
                />
              ))}
            </Box>
          )}

          {post.sourceUrl && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Source:{" "}
              <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">
                {post.sourceUrl}
              </a>
            </Typography>
          )}

          <Button
            size="small"
            startIcon={<FlagIcon />}
            onClick={() => openReport({ postId: id })}
            sx={{ mt: 1 }}
          >
            Report
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            <CommentIcon sx={{ verticalAlign: "middle", mr: 1 }} />
            Comments
          </Typography>

          {comments.length === 0 ? (
            <Typography color="text.secondary">No comments yet.</Typography>
          ) : (
            <List>
              {comments.map((c) => (
                <ListItem
                  key={c.id}
                  alignItems="flex-start"
                  sx={{ px: 0 }}
                  secondaryAction={
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        color={c.liked ? "primary" : "default"}
                        onClick={() => toggleCommentLike(c.id)}
                      >
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                      <Typography variant="caption" sx={{ alignSelf: "center" }}>
                        {c.likes}
                      </Typography>
                      {currentUser?.id === c.author.id && (
                        <>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const newBody = prompt("Edit comment", c.body);
                              if (newBody !== null) {
                                api(`/v1/comments/${encodeURIComponent(c.id)}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ body: newBody }),
                                }).then(() => loadComments());
                              }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => deleteComment(c.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => openReport({ commentId: c.id })}
                      >
                        <FlagIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={c.author.avatarUrl} alt={c.author.name}>
                      {c.author.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2">
                        {c.author.name}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ display: "block", whiteSpace: "pre-wrap" }}
                        >
                          {c.body}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(c.createdAt).toLocaleString()}
                          {c.updatedAt !== c.createdAt ? " (edited)" : ""}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Divider sx={{ my: 2 }} />

          <form onSubmit={submitComment}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={6}
              placeholder="Add a comment"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 5000 } }}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              endIcon={<SendIcon />}
              disabled={!commentText.trim()}
            >
              Post comment
            </Button>
            {commentStatus && (
              <Typography
                variant="body2"
                color={commentStatus.includes("Please") ? "error" : "text.secondary"}
                sx={{ mt: 1 }}
              >
                {commentStatus}
              </Typography>
            )}
          </form>
        </CardContent>
      </Card>

      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)}>
        <DialogTitle>Report</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select a reason for reporting:
          </DialogContentText>
          <TextField
            select
            fullWidth
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            slotProps={{ select: { native: true } }}
          >
            <option value="spam">Spam</option>
            <option value="copyright">Copyright</option>
            <option value="harassment">Harassment</option>
            <option value="illegal">Illegal</option>
            <option value="sexual">Sexual</option>
            <option value="violence">Violence</option>
            <option value="other">Other</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button onClick={submitReport} color="error">
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
