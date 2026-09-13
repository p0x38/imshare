import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Grid,
  Avatar,
  Box,
  Skeleton,
  Link,
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { api } from "../api";

interface UserProfile {
  id: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  accentColor?: string;
  profileBannerUrl?: string;
  websiteUrl?: string;
  githubUrl?: string;
  profileLinks?: { id: string; label: string; url: string }[];
  _count: { posts: number };
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  caption?: string;
  uploads?: { url: string }[];
  reactions?: { like: number };
}

export default function UserView() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const id = decodeURIComponent(userId || "");

  useEffect(() => {
    const load = async () => {
      try {
        const [ur, pr]: any[] = await Promise.all([
          api(`/v1/users/${encodeURIComponent(id)}`),
          api(`/v1/users/${encodeURIComponent(id)}/posts?limit=100`),
        ]);
        setUser(ur.data);
        setPosts(pr.data);
      } catch {
        setUser(null);
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
        <Skeleton variant="rectangular" height={200} sx={{ my: 2 }} />
      </Card>
    );
  }

  if (!user) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h5">User not found</Typography>
      </Card>
    );
  }

  const popularPosts = [...posts]
    .sort((a, b) => (b.reactions?.like || 0) - (a.reactions?.like || 0))
    .slice(0, 6);

  return (
    <>
      {user.profileBannerUrl && (
        <Box
          component="img"
          src={user.profileBannerUrl}
          alt=""
          sx={{
            width: "100%",
            maxHeight: 280,
            objectFit: "cover",
            borderRadius: 2,
            mb: 2,
          }}
        />
      )}

      <Card sx={{ mb: 3, borderLeft: `4px solid ${user.accentColor || "#90caf9"}` }}>
        <CardContent>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <Avatar
              src={user.avatarUrl}
              alt={user.name}
              sx={{ width: 96, height: 96 }}
            >
              {user.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h4">{user.name}</Typography>
              <Typography color="text.secondary">
                {user._count.posts} post(s) · Joined{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </Typography>
              {user.bio && <Typography sx={{ mt: 1 }}>{user.bio}</Typography>}
              <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
                {user.websiteUrl && (
                  <Link
                    href={user.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    Website
                  </Link>
                )}
                {user.githubUrl && (
                  <Link
                    href={user.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    GitHub
                  </Link>
                )}
                {user.profileLinks?.map((l) => (
                  <Link
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {l.label}
                  </Link>
                ))}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Basic information
          </Typography>
          <Typography color="text.secondary">
            Joined {new Date(user.createdAt).toLocaleString()} ·{" "}
            {user._count.posts} post(s)
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent posts
          </Typography>
          <Grid container spacing={2}>
            {posts.slice(0, 6).length === 0 ? (
              <Grid size={12}>
                <Typography color="text.secondary">No posts yet.</Typography>
              </Grid>
            ) : (
              posts.slice(0, 6).map((p) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                  <Card>
                    <CardActionArea
                      component={RouterLink}
                      to={`/posts/${encodeURIComponent(p.id)}`}
                    >
                      {p.uploads?.[0] && (
                        <CardMedia
                          component="img"
                          height="150"
                          image={`${p.uploads[0].url}?width=320&format=webp`}
                          alt={p.caption || p.title}
                          loading="lazy"
                        />
                      )}
                      <CardContent>
                        <Typography variant="subtitle2" noWrap>
                          {p.title}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Popular posts
          </Typography>
          <Grid container spacing={2}>
            {popularPosts.length === 0 ? (
              <Grid size={12}>
                <Typography color="text.secondary">No posts yet.</Typography>
              </Grid>
            ) : (
              popularPosts.map((p) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                  <Card>
                    <CardActionArea
                      component={RouterLink}
                      to={`/posts/${encodeURIComponent(p.id)}`}
                    >
                      {p.uploads?.[0] && (
                        <CardMedia
                          component="img"
                          height="150"
                          image={`${p.uploads[0].url}?width=320&format=webp`}
                          alt={p.caption || p.title}
                          loading="lazy"
                        />
                      )}
                      <CardContent>
                        <Typography variant="subtitle2" noWrap>
                          {p.title}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </CardContent>
      </Card>
    </>
  );
}
