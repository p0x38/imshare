import { useState, useEffect } from "react";
import {
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Dashboard as DashboardIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api";

interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  avatarMode?: string;
  avatarValue?: string;
  websiteUrl?: string;
  githubUrl?: string;
  profileLinks?: { id: string; label: string; url: string }[];
}

export default function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [avatarMode, setAvatarMode] = useState("initials");
  const [avatarValue, setAvatarValue] = useState("");
  const [avatarSource, setAvatarSource] = useState<"upload" | "url">("url");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [status, setStatus] = useState("");

  const loadAccount = async () => {
    try {
      const r: any = await api("/v1/me");
      const data = r.data;
      setUser(data);
      setName(data.name || "");
      setBio(data.bio || "");
      setWebsiteUrl(data.websiteUrl || "");
      setGithubUrl(data.githubUrl || "");
      setAvatarMode(data.avatarMode || "initials");
      setAvatarValue(data.avatarValue || "");
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus("");
    try {
      await api(`/v1/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio || null,
          websiteUrl: websiteUrl || null,
          githubUrl: githubUrl || null,
          avatarMode,
          avatarValue: avatarValue || null,
        }),
      });
      setStatus("Profile saved.");
      loadAccount();
    } catch {
      setStatus("Unable to save profile.");
    }
  };

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const response = await fetch("/v1/uploads?multiple=false", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Upload failed.");
      }
      setAvatarMode("custom");
      setAvatarValue(payload.data.id);
      setStatus("Image uploaded. Save profile to apply it.");
    } catch {
      setStatus("Unable to upload image.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/v1/me/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: linkLabel, url: linkUrl }),
      });
      setLinkLabel("");
      setLinkUrl("");
      loadAccount();
    } catch {
      alert("Unable to add profile link.");
    }
  };

  const deleteLink = async (linkId: string) => {
    await api(`/v1/me/links/${encodeURIComponent(linkId)}`, {
      method: "DELETE",
    });
    loadAccount();
  };

  const handleLogout = async () => {
    try {
      await fetch("/v1/auth/sign-out", { method: "POST" });
    } catch {}
    window.location.href = "/";
  };

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography color="text.secondary">Checking session...</Typography>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>
          You are not signed in.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button
            variant="contained"
            component={RouterLink}
            to="/account/login/"
          >
            Log in
          </Button>
          <Button variant="outlined" component={RouterLink} to="/account/register/">
            Create account
          </Button>
        </Box>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Avatar src={user.avatarUrl} sx={{ width: 80, height: 80 }}>
              {user.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5">{user.name || "Account"}</Typography>
              <Typography color="text.secondary">{user.email}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Edit profile
          </Typography>
          {status && (
            <Alert severity={status.includes("saved") ? "success" : "error"} sx={{ mb: 2 }}>
              {status}
            </Alert>
          )}
          <form onSubmit={handleProfileSubmit}>
            <TextField
              label="Name"
              fullWidth
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Profile description"
              fullWidth
              multiline
              minRows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Profile avatar</InputLabel>
              <Select
                value={avatarMode}
                label="Profile avatar"
                onChange={(e) => setAvatarMode(e.target.value)}
              >
                <MenuItem value="initials">Text / initials</MenuItem>
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="identicon">Identicon</MenuItem>
                <MenuItem value="gravatar">Gravatar</MenuItem>
                <MenuItem value="custom">Custom image</MenuItem>
              </Select>
            </FormControl>
            {avatarMode === "custom" && (
              <Box sx={{ mb: 2 }}>
                <RadioGroup
                  row
                  value={avatarSource}
                  onChange={(e) =>
                    setAvatarSource(e.target.value as "upload" | "url")
                  }
                >
                  <FormControlLabel
                    value="upload"
                    control={<Radio />}
                    label="Upload a file"
                  />
                  <FormControlLabel
                    value="url"
                    control={<Radio />}
                    label="Use an image URL"
                  />
                </RadioGroup>
                {avatarSource === "upload" ? (
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? "Uploading..." : "Choose image file"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleAvatarFile}
                    />
                  </Button>
                ) : (
                  <TextField
                    label="Custom avatar URL"
                    fullWidth
                    type="url"
                    value={avatarValue}
                    onChange={(e) => setAvatarValue(e.target.value)}
                    placeholder="https://..."
                    sx={{ mb: 2 }}
                  />
                )}
              </Box>
            )}
            <TextField
              label="Website"
              type="url"
              fullWidth
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="GitHub"
              type="url"
              fullWidth
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained">
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Profile links
          </Typography>
          {user.profileLinks && user.profileLinks.length > 0 ? (
            <List>
              {user.profileLinks.map((link) => (
                <ListItem
                  key={link.id}
                  secondaryAction={
                    <IconButton edge="end" onClick={() => deleteLink(link.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                        {link.label}
                      </a>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary">No extra links yet.</Typography>
          )}
          <Box component="form" onSubmit={handleLinkSubmit} sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField
              label="Label"
              size="small"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Mastodon, Bluesky, Portfolio..."
              required
            />
            <TextField
              label="URL"
              type="url"
              size="small"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              required
            />
            <Button type="submit" variant="outlined" size="small">
              Add link
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          component={RouterLink}
          to="/dashboard/"
        >
          Dashboard
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
        >
          Log out
        </Button>
      </Box>
    </>
  );
}
