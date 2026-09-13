import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Grid,
  Button,
  Skeleton,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { api } from "../api";

interface Post {
  id: string;
  title: string;
  uploads?: { url: string }[];
}

export default function DashboardPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api("/v1/me/posts?limit=100")
      .then((r: any) => setPosts(r.data))
      .catch((e) => {
        if (e.status === 401) navigate("/account/login/");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Typography variant="h4" gutterBottom>
        My Posts
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        component={RouterLink}
        to="/dashboard/posts/new/"
        sx={{ mb: 2 }}
      >
        New post
      </Button>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {posts.length} post(s)
      </Typography>
      <Grid container spacing={2}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
                <Card>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton width="80%" />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : posts.map((p) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={p.id}>
                <Card>
                  <CardActionArea
                    component={RouterLink}
                    to={`/dashboard/posts/${encodeURIComponent(p.id)}/`}
                  >
                    {p.uploads?.[0] && (
                      <CardMedia
                        component="img"
                        height="200"
                        image={`${p.uploads[0].url}?width=480&format=webp`}
                        alt={p.title}
                        loading="lazy"
                      />
                    )}
                    <CardContent>
                      <Typography variant="h6" noWrap>
                        {p.title}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
      </Grid>
    </>
  );
}
