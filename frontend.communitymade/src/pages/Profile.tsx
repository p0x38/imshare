import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from "@mui/material";
import { api } from "../api";

interface User {
  id: string;
  avatarMode?: string;
  avatarValue?: string;
  profileBannerUrl?: string;
  accentColor?: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState("initials");
  const [value, setValue] = useState("");
  const [banner, setBanner] = useState("");
  const [accent, setAccent] = useState("#0645ad");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/v1/me")
      .then((r: any) => {
        const u = r.data;
        setUser(u);
        setMode(u.avatarMode || "initials");
        setValue(u.avatarValue || "");
        setBanner(u.profileBannerUrl || "");
        setAccent(u.accentColor || "#0645ad");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus("");
    try {
      await api(`/v1/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarMode: mode,
          avatarValue: value || null,
          profileBannerUrl: banner || null,
          accentColor: accent,
        }),
      });
      setStatus("Profile settings saved.");
    } catch (err: any) {
      setStatus(err.message);
    }
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h5">Please sign in.</Typography>
      </Card>
    );
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Profile settings
      </Typography>
      <Card>
        <CardContent>
          {status && (
            <Alert severity={status.includes("saved") ? "success" : "error"} sx={{ mb: 2 }}>
              {status}
            </Alert>
          )}
          <form onSubmit={handleSubmit}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Avatar mode</InputLabel>
              <Select
                value={mode}
                label="Avatar mode"
                onChange={(e) => setMode(e.target.value)}
              >
                <MenuItem value="initials">Text / initials</MenuItem>
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="identicon">Identicon</MenuItem>
                <MenuItem value="gravatar">Gravatar</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Avatar value"
              fullWidth
              value={value}
              onChange={(e) => setValue(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Profile banner URL"
              type="url"
              fullWidth
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="https://..."
              sx={{ mb: 2 }}
            />
            <TextField
              label="Accent color"
              type="color"
              fullWidth
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained">
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
