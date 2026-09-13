import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Skeleton,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { Link as RouterLink, useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

interface Post {
  id: string;
  title: string;
}

export default function DashboardPostView() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const id = decodeURIComponent(postId || "");

  useEffect(() => {
    api(`/v1/posts/${encodeURIComponent(id)}`)
      .then((r: any) => setPost(r.data))
      .catch((e) => {
        if (e.status === 401) navigate("/account/login/");
        setError("Post not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      const r = await fetch(`/v1/posts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (r.ok) navigate("/dashboard/posts/");
      else alert("Unable to delete post.");
    } catch {
      alert("Unable to delete post.");
    }
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" height={40} width="60%" />
      </Card>
    );
  }

  if (error || !post) {
    return (
      <Card sx={{ p: 4 }}>
        <Typography variant="h5">Post not found</Typography>
      </Card>
    );
  }

  return (
    <>
      <Button
        component={RouterLink}
        to="/dashboard/posts/"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        My posts
      </Button>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            {post.title}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              component={RouterLink}
              to={`/dashboard/posts/${encodeURIComponent(id)}/edit/`}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button
              variant="outlined"
              startIcon={<ViewIcon />}
              component={RouterLink}
              to={`/posts/${encodeURIComponent(id)}`}
            >
              View public post
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
