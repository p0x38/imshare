import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Grid,
  TextField,
  Button,
  Skeleton,
  Box,
} from "@mui/material";
import {
  Search as SearchIcon,
  ThumbUp as ThumbUpIcon,
  Star as StarIcon,
  Bookmark as BookmarkIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

interface Post {
  id: string;
  title: string;
  caption?: string;
  author?: { name: string };
  uploads?: { url: string }[];
  reactions?: { like: number; favorite: number; save: number };
}

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 48;

  const load = async (q: string, p: number) => {
    setLoading(true);
    try {
      const r: any = await api(
        `/v1/posts?page=${p}&limit=${limit}${q ? `&search=${encodeURIComponent(q)}` : ""}`
      );
      setPosts(r.data);
      setTotalPages(r.pagination?.totalPages || 1);
      setTotal(r.pagination?.total || 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(query, page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(query, 1);
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Posts
      </Typography>
      <Card sx={{ mb: 3, p: 2 }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
          <TextField
            size="small"
            placeholder="Search posts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button type="submit" variant="contained" startIcon={<SearchIcon />}>
            Search
          </Button>
        </form>
      </Card>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {total} post(s)
      </Typography>
      <Grid container spacing={2}>
        {loading
          ? Array.from({ length: 12 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
                <Card>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton width="80%" />
                    <Skeleton width="60%" />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : posts.map((post) => {
              const image = post.uploads?.[0];
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={post.id}>
                  <Card>
                    <CardActionArea
                      component={RouterLink}
                      to={`/posts/${encodeURIComponent(post.id)}`}
                    >
                      {image && (
                        <CardMedia
                          component="img"
                          height="200"
                          image={`${image.url}?width=480&height=480&fit=cover&format=webp`}
                          alt={post.caption || post.title}
                          loading="lazy"
                        />
                      )}
                      <CardContent>
                        <Typography variant="h6" noWrap>
                          {post.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {post.author?.name || "Unknown author"}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            <ThumbUpIcon sx={{ fontSize: 14, verticalAlign: "middle" }} /> {post.reactions?.like || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <StarIcon sx={{ fontSize: 14, verticalAlign: "middle" }} /> {post.reactions?.favorite || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <BookmarkIcon sx={{ fontSize: 14, verticalAlign: "middle" }} /> {post.reactions?.save || 0}
                          </Typography>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
      </Grid>
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2, mt: 3 }}>
        <Button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          startIcon={<ArrowBackIcon />}
        >
          Previous
        </Button>
        <Typography>
          Page {page} / {Math.max(1, totalPages)}
        </Typography>
        <Button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          endIcon={<ArrowForwardIcon />}
        >
          Next
        </Button>
      </Box>
    </>
  );
}
