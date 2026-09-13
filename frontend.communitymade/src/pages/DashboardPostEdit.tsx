import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { Link as RouterLink, useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

interface Category {
  id: string;
  name: string;
}

export default function DashboardPostEdit() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const id = decodeURIComponent(postId || "");

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, catsRes]: any[] = await Promise.all([
          api(`/v1/posts/${encodeURIComponent(id)}`),
          api("/v1/categories?limit=100"),
        ]);
        const p = postRes.data;
        setTitle(p.title || "");
        setCaption(p.caption || "");
        setDescription(p.description || "");
        setSourceUrl(p.sourceUrl || "");
        setAllowDownload(p.allowDownload !== false);
        setTags((p.tags || []).map((t: any) => t.name).join(", "));
        setCategoryId(p.category?.id || "");
        setCategories(catsRes.data);
      } catch {
        setError("Unable to load this post.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const r = await fetch(`/v1/posts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          caption: caption || null,
          description: description || null,
          sourceUrl: sourceUrl || null,
          allowDownload,
          tags: tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          categoryId: categoryId || null,
        }),
      });
      if (r.ok) navigate(`/dashboard/posts/${encodeURIComponent(id)}/`);
      else setError("Unable to save changes.");
    } catch {
      setError("Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" height={40} width="60%" />
      </Card>
    );
  }

  if (error && !title) {
    return (
      <Card sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Card>
    );
  }

  return (
    <>
      <Button
        component={RouterLink}
        to={`/dashboard/posts/${encodeURIComponent(id)}/`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to post
      </Button>
      <Card sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Edit Post
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <TextField
              label="Title"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Image caption"
              fullWidth
              multiline
              minRows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 10000 } }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Source URL"
              type="url"
              fullWidth
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                />
              }
              label="Allow visitors to download the original image"
              sx={{ mb: 2, display: "block" }}
            />
            <TextField
              label="Tags"
              fullWidth
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryId}
                label="Category"
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
