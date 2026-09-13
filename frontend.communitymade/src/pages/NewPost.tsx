import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  LinearProgress,
  Grid,
} from "@mui/material";
import { CloudUpload as UploadIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

interface Category {
  id: string;
  name: string;
}

export default function NewPost() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    fetch("/v1/categories?limit=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCategories(d?.data || []))
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const arr = Array.from(fileList);
    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
  };

  const uploadFiles = (filesToUpload: File[]): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/v1/uploads?multiple=true");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
          setUploadStatus(`Uploading... ${pct}%`);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadStatus("Upload complete");
          resolve(JSON.parse(xhr.responseText).data);
        } else {
          reject(new Error(xhr.status === 429 ? "Upload rate limit exceeded." : "Image upload failed."));
        }
      };
      xhr.onerror = () => reject(new Error("Image upload failed."));
      const data = new FormData();
      for (const f of filesToUpload) data.append("file", f);
      xhr.send(data);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!files.length) throw new Error("Please choose at least one image.");
      const uploads = await uploadFiles(files);
      const tagList = tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const r = await fetch("/v1/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          caption: caption || null,
          description: description || null,
          sourceUrl: sourceUrl || null,
          allowDownload,
          uploadIds: uploads.map((x: any) => x.id),
          tags: tagList,
          categoryId: categoryId || null,
        }),
      });
      if (!r.ok) throw new Error("Post creation failed.");
      const result = await r.json();
      navigate(`/posts/${encodeURIComponent(result.data.id)}`);
    } catch (err: any) {
      setError(err.message || "Unable to create post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 720, mx: "auto" }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          New Post
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Title"
            fullWidth
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
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
            placeholder="Text shown below the image"
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

          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileRef.current?.click()}
            sx={{ mb: 2 }}
          >
            Choose images
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFileChange}
          />

          {previews.length > 0 && (
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {previews.map((src, i) => (
                <Grid size={{ xs: 6, sm: 4 }} key={i}>
                  <Box
                    component="img"
                    src={src}
                    alt={files[i]?.name}
                    sx={{ width: "100%", borderRadius: 1 }}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {loading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {uploadStatus}
              </Typography>
            </Box>
          )}

          <TextField
            label="Source URL"
            type="url"
            fullWidth
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/"
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
            placeholder="art, landscape, original"
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
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
