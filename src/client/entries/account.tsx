import { Add, Delete, DragHandle } from "@mui/icons-material";
import { Alert, Avatar, Button, Card, CardContent, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface EditableProfileLink {
    id?: string;
    label: string;
    url: string;
}

function AccountPage() {
    const [user, setUser] = useState<User | false | null>(null);
    const [error, setError] = useState("");
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarMode, setAvatarMode] = useState("initials");
    const [avatarValue, setAvatarValue] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [profileLinks, setProfileLinks] = useState<EditableProfileLink[]>([]);
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
            setProfileLinks((next.profileLinks || []).map(({ id, label, url }) => ({ id, label, url })));
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
        setError("");
        try {
            await api(`/v1/users/${encodeURIComponent(user.id)}`, {
                method: "PATCH",
                body: JSON.stringify({ name, bio: bio || null, websiteUrl: websiteUrl || null, githubUrl: githubUrl || null, avatarMode, avatarValue: avatarValue || null }),
            });
            const existing = new Set((user.profileLinks || []).map((link) => link.id));
            for (const [position, link] of profileLinks.entries()) {
                if (!link.label.trim() || !link.url.trim()) continue;
                if (link.id && existing.has(link.id)) {
                    await api(`/v1/me/links/${encodeURIComponent(link.id)}`, {
                        method: "PATCH",
                        body: JSON.stringify({ label: link.label.trim(), url: link.url.trim(), position }),
                    });
                } else {
                    await api("/v1/me/links", {
                        method: "POST",
                        body: JSON.stringify({ label: link.label.trim(), url: link.url.trim(), position }),
                    });
                }
            }
            const currentIds = new Set(profileLinks.flatMap((link) => link.id ? [link.id] : []));
            for (const link of user.profileLinks || []) {
                if (!currentIds.has(link.id)) await api(`/v1/me/links/${encodeURIComponent(link.id)}`, { method: "DELETE" });
            }
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save profile.");
        } finally {
            setSaving(false);
        }
    }

    if (error && user === null) return <Page><Alert severity="error">{error}</Alert></Page>;
    if (user === null) return <Page><LoadingState label="Loading account…" /></Page>;
    if (user === false) return <Page><Card variant="outlined"><CardContent><Typography variant="h4" component="h1" gutterBottom>Account</Typography><Typography paragraph>You are not signed in.</Typography><Button variant="contained" component="a" href="/account/login/">Log in</Button><Button component="a" href="/account/register/" sx={{ ml: 1 }}>Create account</Button></CardContent></Card></Page>;

    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">Account</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                <Card variant="outlined"><CardContent><Stack direction="row" spacing={2} alignItems="center"><Avatar src={user.avatarUrl ?? undefined} sx={{ width: 80, height: 80 }}>{(user.name || "A").charAt(0).toUpperCase()}</Avatar><Stack><Typography variant="h6">{user.name || "Account"}</Typography><Typography color="text.secondary">{user.email}</Typography></Stack></Stack></CardContent></Card>
                <Card variant="outlined" component="form" onSubmit={save}><CardContent><Typography variant="h6" component="h2" gutterBottom>Profile</Typography><Stack spacing={2}>
                    <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
                    <TextField label="Profile description" value={bio} onChange={(event) => setBio(event.target.value)} multiline minRows={4} />
                    <FormControl fullWidth><InputLabel id="avatar-mode-label">Profile avatar</InputLabel><Select labelId="avatar-mode-label" label="Profile avatar" value={avatarMode} onChange={(event) => setAvatarMode(event.target.value)}><MenuItem value="initials">Text / initials</MenuItem><MenuItem value="default">Default</MenuItem><MenuItem value="identicon">Identicon</MenuItem><MenuItem value="gravatar">Gravatar</MenuItem><MenuItem value="custom">Custom</MenuItem></Select></FormControl>
                    <TextField label="Custom avatar value" value={avatarValue} onChange={(event) => setAvatarValue(event.target.value)} />
                    <TextField label="Website" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
                    <TextField label="GitHub" type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} />
                    <Stack spacing={1}>
                        <Typography variant="h6" component="h2">Profile links</Typography>
                        <Typography variant="body2" color="text.secondary">Add any public links you want to show on your profile.</Typography>
                        {profileLinks.map((link, index) => (
                            <Stack key={link.id || `new-${index}`} direction="row" spacing={1} alignItems="center">
                                <DragHandle color="disabled" />
                                <TextField label="Label" value={link.label} onChange={(event) => setProfileLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
                                <TextField label="URL" type="url" value={link.url} onChange={(event) => setProfileLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} sx={{ flexGrow: 1 }} />
                                <IconButton aria-label="Delete profile link" onClick={() => setProfileLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                                    <Delete />
                                </IconButton>
                            </Stack>
                        ))}
                        <Button startIcon={<Add />} onClick={() => setProfileLinks((current) => [...current, { label: "", url: "" }])} disabled={profileLinks.length >= 20}>Add profile link</Button>
                    </Stack>
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
                </Stack></CardContent></Card>
                <Stack direction="row" spacing={1}><Button variant="outlined" component="a" href="/dashboard/">Dashboard</Button><Button component="a" href="/account/logout/">Log out</Button></Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#account-page");
if (root) createRoot(root).render(<App><AccountPage /></App>);
