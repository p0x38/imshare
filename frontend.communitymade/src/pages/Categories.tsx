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

interface Category {
  id: string;
  name: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/v1/categories?limit=100")
      .then((r: any) => setCategories(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Categories
      </Typography>
      <Grid container spacing={2}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rectangular" height={60} />
              </Grid>
            ))
          : categories.map((c) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.id}>
                <Card>
                  <CardActionArea
                    component={RouterLink}
                    to={`/categories/${encodeURIComponent(c.id)}`}
                  >
                    <CardContent>
                      <Typography variant="h6">{c.name}</Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
      </Grid>
    </>
  );
}
