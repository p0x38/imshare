import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Grid,
  Skeleton,
  Button,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

interface Post {
  id: string;
  title: string;
  caption?: string;
  author?: { name: string };
  uploads?: { url: string; thumbhash?: string }[];
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/v1/posts?limit=24")
      .then((r: any) => setPosts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Card sx={{ mb: 3, p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Recent artwork
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          A self-hosted image archive.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={RouterLink}
          to="/dashboard/posts/new/"
        >
          New post
        </Button>
      </Card>

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
          : posts.length === 0 ? (
              <Grid size={12}>
                <Typography color="text.secondary">No posts yet.</Typography>
              </Grid>
            ) : (
              posts.map((post) => {
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
                            image={`${image.url}?width=480&format=webp`}
                            alt={post.title}
                            loading="lazy"
                          />
                        )}
                        <CardContent>
                          <Typography variant="h6" noWrap>
                            {post.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {post.author?.name ?? "Unknown author"}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })
            )}
      </Grid>
    </>
  );
}
