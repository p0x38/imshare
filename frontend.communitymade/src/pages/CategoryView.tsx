import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Grid,
  Skeleton,
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { api } from "../api";

interface Category {
  id: string;
  name: string;
}

interface Post {
  id: string;
  title: string;
  uploads?: { url: string }[];
}

export default function CategoryView() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const id = decodeURIComponent(categoryId || "");

  useEffect(() => {
    const load = async () => {
      try {
        const [cr, pr]: any[] = await Promise.all([
          api(`/v1/categories/${encodeURIComponent(id)}`),
          api(`/v1/categories/${encodeURIComponent(id)}/posts?limit=100`),
        ]);
        setCategory(cr.data);
        setPosts(pr.data);
      } catch {
        setCategory(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" height={40} width="60%" />
      </Card>
    );
  }

  if (!category) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h5">Category not found</Typography>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 3, p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {category.name}
        </Typography>
        <Typography color="text.secondary">
          {posts.length} post(s)
        </Typography>
      </Card>
      <Grid container spacing={2}>
        {posts.map((post) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={post.id}>
            <Card>
              <CardActionArea
                component={RouterLink}
                to={`/posts/${encodeURIComponent(post.id)}`}
              >
                {post.uploads?.[0] && (
                  <CardMedia
                    component="img"
                    height="200"
                    image={`${post.uploads[0].url}?width=480&format=webp`}
                    alt={post.title}
                    loading="lazy"
                  />
                )}
                <CardContent>
                  <Typography variant="h6" noWrap>
                    {post.title}
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
