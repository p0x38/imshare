import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Skeleton,
  Chip,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

interface Tag {
  id: string;
  name: string;
}

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/v1/tags?limit=100")
      .then((r: any) => setTags(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Tags
      </Typography>
      <Grid container spacing={2}>
        {loading
          ? Array.from({ length: 12 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rectangular" height={60} />
              </Grid>
            ))
          : tags.map((t) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                <Card>
                  <CardActionArea
                    component={RouterLink}
                    to={`/tags/${encodeURIComponent(t.id)}`}
                  >
                    <CardContent>
                      <Chip label={t.name} />
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
      </Grid>
    </>
  );
}
