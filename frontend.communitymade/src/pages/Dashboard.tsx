import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Skeleton,
} from "@mui/material";
import {
  Image as ImageIcon,
  Add as AddIcon,
  Label as LabelIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { api } from "../api";

interface User {
  name: string;
  email: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api("/v1/me")
      .then((r: any) => setUser(r.data))
      .catch(() => navigate("/account/login/"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" height={40} />
      </Card>
    );
  }

  if (!user) return null;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Welcome, {user.name || user.email || "user"}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<ImageIcon />}
              component={RouterLink}
              to="/dashboard/posts/"
            >
              My posts
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              component={RouterLink}
              to="/dashboard/posts/new/"
            >
              New post
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
            <Button
              startIcon={<LabelIcon />}
              component={RouterLink}
              to="/dashboard/tags/"
            >
              Manage tags
            </Button>
            <Button
              startIcon={<CategoryIcon />}
              component={RouterLink}
              to="/dashboard/categories/"
            >
              Manage categories
            </Button>
            <Button
              startIcon={<PersonIcon />}
              component={RouterLink}
              to="/account/"
            >
              Account
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
