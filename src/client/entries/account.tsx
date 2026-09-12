import { Alert, Avatar, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { User } from "../lib/types";

function AccountPage() {
    const [user, setUser] = useState<User | false | null>(null);
    const [error, setError] = useState("");
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarMode, setAvatarMode] = useState("initials");
    const [avatarValue, setAvatarValue] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [saving, setSaving] = useState(false);

    async function load() {
        try {
            const response = await api<{ data: User }>("/v1/me");
            const next = response.data;
            setUser(next);
            setName(next.name || "");
            setBio(next.bio || "");
            setAvatarMode(next.avatarMode || "initials");
            setAvatarValue(next.avatarValue || "");
            setWebsiteUrl(next.websiteUrl || "");
            setGithubUrl(next.githubUrl || "");
        } catch (cause) {
            if ((cause as Error & { status?: number }).status === 401) setUser(false);
            else setError(cause instanceof Error ? cause.message : "Unable to load account information.");
        }
    }

    useEffect(() => { void load(); }, []);

    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (!user) return;
        setSaving(true);
        try {
            await api(`/v1/users/${encodeURIComponent(user.id)}`, {
                method: "PATCH",
                body: JSON.stringify({ name, bio: bio || null, websiteUrl: websiteUrl || null, githubUrl: githubUrl || null, avatarMode, avatarValue: avatarValue || null }),
            });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save profile.");
        } finally {
            setSaving(false);
        }
    }

    if (error) return <Page><Alert severity="error">{error}</Alert></Page>;
    if (user === null) return <Page><LoadingState label="Loading account…" /></Page>;
    if (user === false) return <Page><Card variant="outlined"><CardContent><Typography variant="h4" component="h1" gutterBottom>Account</Typography><Typography paragraph>You are not signed in.</Typography><Button variant="contained" component="a" href="/account/login/">Log in</Button><Button component="a" href="/account/register/" sx={{ ml: 1 }}>Create account</Button></CardContent></Card></Page>;

    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">Account</Typography>
                <Card variant="outlined"><CardContent><Stack direction="row" spacing={2} alignItems="center"><Avatar src={user.avatarUrl} sx={{ width: 80, height: 80 }}>{(user.name || "A").charAt(0).toUpperCase()}</Avatar><Stack><Typography variant="h6">{user.name || "Account"}</Typography><Typography color="text.secondary">{user.email}</Typography></Stack></Stack></CardContent></Card>
                <Card variant="outlined" component="form" onSubmit={save}><CardContent><Typography variant="h6" component="h2" gutterBottom>Profile</Typography><Stack spacing={2}>
                    <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
                    <TextField label="Profile description" value={bio} onChange={(event) => setBio(event.target.value)} multiline minRows={4} />
                    <FormControl fullWidth><InputLabel id="avatar-mode-label">Profile avatar</InputLabel><Select labelId="avatar-mode-label" label="Profile avatar" value={avatarMode} onChange={(event) => setAvatarMode(event.target.value)}><MenuItem value="initials">Text / initials</MenuItem><MenuItem value="default">Default</MenuItem><MenuItem value="identicon">Identicon</MenuItem><MenuItem value="gravatar">Gravatar</MenuItem><MenuItem value="custom">Custom</MenuItem></Select></FormControl>
                    <TextField label="Custom avatar value" value={avatarValue} onChange={(event) => setAvatarValue(event.target.value)} />
                    <TextField label="Website" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
                    <TextField label="GitHub" type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} />
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
                </Stack></CardContent></Card>
                <Stack direction="row" spacing={1}><Button variant="outlined" component="a" href="/dashboard/">Dashboard</Button><Button component="a" href="/account/logout/">Log out</Button></Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#account-page");
if (root) createRoot(root).render(<App><AccountPage /></App>);
