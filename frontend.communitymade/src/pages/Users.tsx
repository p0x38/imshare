import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Skeleton,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

interface User {
  id: string;
  name: string;
  _count?: { posts: number };
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/v1/users?limit=100")
      .then((r: any) => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Users
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {users.length} user(s)
      </Typography>
      <Grid container spacing={2}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="40%" />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : users.map((u) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={u.id}>
                <Card>
                  <CardActionArea
                    component={RouterLink}
                    to={`/users/${encodeURIComponent(u.id)}`}
                  >
                    <CardContent>
                      <Typography variant="h6" noWrap>
                        {u.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {u._count?.posts ?? 0} post(s)
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
