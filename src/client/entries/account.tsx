import { Add, Delete, DragHandle, UploadFile } from "@mui/icons-material";
import { Alert, Avatar, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { AccountPreferences } from "../components/AccountPreferences";
import { DevicesSecurity } from "../components/DevicesSecurity";
import { OidcLoginButton } from "../components/OidcLoginButton";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { TwoFactorChallenge } from "../components/TwoFactorChallenge";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface EditableProfileLink { id?: string; label: string; url: string; }
function AccountPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | false | null>(null); const [error, setError] = useState(""); const [name, setName] = useState(""); const [handle, setHandle] = useState(""); const [bio, setBio] = useState(""); const [avatarMode, setAvatarMode] = useState("initials"); const [avatarValue, setAvatarValue] = useState(""); const [websiteUrl, setWebsiteUrl] = useState(""); const [githubUrl, setGithubUrl] = useState(""); const [profileLinks, setProfileLinks] = useState<EditableProfileLink[]>([]); const [saving, setSaving] = useState(false); const [tab, setTab] = useState(0);
    async function load() { try { const response = await api<{ data: User }>("/v1/me"); const next = response.data; setUser(next); setName(next.name || ""); setHandle(next.handle || ""); setBio(next.bio || ""); setAvatarMode(next.avatarMode || "initials"); setAvatarValue(next.avatarValue || ""); setWebsiteUrl(next.websiteUrl || ""); setGithubUrl(next.githubUrl || ""); setProfileLinks((next.profileLinks || []).map(({ id, label, url }) => ({ id, label, url }))); } catch (cause) { if ((cause as Error & { status?: number }).status === 401) setUser(false); else setError(cause instanceof Error ? cause.message : t("accountPage.loadError")); } }
    useEffect(() => { void load(); }, []);
    async function uploadAvatar(file: File) {
        if (!user) return;
        setUploadingAvatar(true); setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await api<{ data: { id: string; url: string } }>("/v1/uploads", {
                method: "POST",
                body: formData,
            });
            const upload = response.data;
            setAvatarMode("custom");
            setAvatarValue(upload.id);
            setUser({ ...user, avatarUrl: upload.url });
            await api(`/v1/users/${encodeURIComponent(user.id)}`, {
                method: "PATCH",
                body: JSON.stringify({ avatarMode: "custom", avatarValue: upload.id }),
            });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("accountPage.avatarUploadError"));
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = "";
        }
    }

    async function save(event: React.FormEvent) { event.preventDefault(); if (!user) return; setSaving(true); setError(""); try { await api(`/v1/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ name, handle: handle.trim().replace(/^@/, "").toLowerCase() || null, bio: bio || null, websiteUrl: websiteUrl || null, githubUrl: githubUrl || null, avatarMode, avatarValue: avatarValue || null }) }); const existing = new Set((user.profileLinks || []).map((link) => link.id)); for (const [position, link] of profileLinks.entries()) { if (!link.label.trim() || !link.url.trim()) continue; if (link.id && existing.has(link.id)) await api(`/v1/me/links/${encodeURIComponent(link.id)}`, { method: "PATCH", body: JSON.stringify({ label: link.label.trim(), url: link.url.trim(), position }) }); else await api("/v1/me/links", { method: "POST", body: JSON.stringify({ label: link.label.trim(), url: link.url.trim(), position }) }); } const currentIds = new Set(profileLinks.flatMap((link) => (link.id ? [link.id] : []))); for (const link of user.profileLinks || []) if (!currentIds.has(link.id)) await api(`/v1/me/links/${encodeURIComponent(link.id)}`, { method: "DELETE" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : t("accountPage.saveError")); } finally { setSaving(false); } }
    if (error && user === null) return <Page><Alert severity="error">{error}</Alert></Page>;
    if (user === null) return <Page><LoadingState label={t("accountPage.loadingAccount")} /></Page>;
    if (user === false) return <Page maxWidth="sm"><Stack spacing={2}><Card variant="outlined"><CardContent><Stack spacing={2}><Typography variant="h4" component="h1" gutterBottom>{t("accountPage.account")}</Typography><Typography paragraph>{t("accountPage.notSignedIn")}</Typography><Button variant="contained" component="a" href="/account/login/">{t("accountPage.logIn")}</Button><Button component="a" href="/account/register/">{t("accountPage.createAccount")}</Button><OidcLoginButton /></Stack></CardContent></Card></Stack></Page>;
    if (new URLSearchParams(location.search).get("twoFactor") === "1") return <Page maxWidth="sm"><TwoFactorChallenge /></Page>;
    return <Page><Stack spacing={2}>
        <Typography variant="h4" component="h1">{t("accountPage.account")}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Card variant="outlined"><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth"><Tab label="Profile" /><Tab label="Settings" /><Tab label="Devices & Security" /></Tabs></Card>
        {tab === 0 ? <Stack spacing={2}>
            <Card variant="outlined"><CardContent><Stack direction="row" spacing={2} alignItems="center"><Avatar src={user.avatarUrl ?? undefined} sx={{ width: 80, height: 80 }}>{(user.name || "A").charAt(0).toUpperCase()}</Avatar><Stack><Typography variant="h6">{user.name || t("common.account")}</Typography><Typography color="text.secondary">{user.handle ? `@${user.handle}` : user.email}</Typography>{user.handle && <Typography variant="body2" color="text.secondary">{user.email}</Typography>}</Stack></Stack></CardContent></Card>
            <Card variant="outlined" component="form" onSubmit={save}><CardContent><Typography variant="h6" component="h2" gutterBottom>{t("accountPage.profile")}</Typography><Stack spacing={2}>
                <TextField label={t("accountPage.name")} value={name} onChange={(e) => setName(e.target.value)} required />
                <TextField label={t("accountPage.customHandle")} value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, "").toLowerCase())} placeholder="p0x38" helperText={t("accountPage.handleHelp")} />
                <TextField label={t("accountPage.profileDescription")} value={bio} onChange={(e) => setBio(e.target.value)} multiline minRows={4} />
                <FormControl fullWidth><InputLabel id="avatar-mode-label">{t("accountPage.profileAvatar")}</InputLabel><Select labelId="avatar-mode-label" label={t("accountPage.profileAvatar")} value={avatarMode} onChange={(e) => setAvatarMode(e.target.value)}><MenuItem value="initials">{t("accountPage.textInitials")}</MenuItem><MenuItem value="default">{t("accountPage.defaultAvatar")}</MenuItem><MenuItem value="identicon">{t("accountPage.identicon")}</MenuItem><MenuItem value="gravatar">{t("accountPage.gravatar")}</MenuItem><MenuItem value="custom">{t("accountPage.custom")}</MenuItem></Select></FormControl>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Button variant="outlined" startIcon={<UploadFile />} component="label" disabled={uploadingAvatar}>
                        {uploadingAvatar ? t("accountPage.uploadingAvatar") : t("accountPage.uploadAvatar")}
                        <input ref={avatarInputRef} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); }} />
                    </Button>
                    <Typography variant="body2" color="text.secondary">{t("accountPage.uploadAvatarHelp")}</Typography>
                </Stack>
                <TextField label={t("accountPage.customAvatarValue")} value={avatarValue} onChange={(e) => setAvatarValue(e.target.value)} />
                <TextField label={t("accountPage.website")} type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                <TextField label={t("accountPage.github")} type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
                <Stack spacing={1}><Typography variant="h6" component="h2">{t("accountPage.profileLinks")}</Typography><Typography variant="body2" color="text.secondary">{t("accountPage.profileLinksHelp")}</Typography>{profileLinks.map((link, index) => <Stack key={link.id || `new-${index}`} direction="row" spacing={1} alignItems="center"><DragHandle color="disabled" /><TextField label={t("accountPage.label")} value={link.label} onChange={(e) => setProfileLinks((c) => c.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} /><TextField label={t("accountPage.url")} type="url" value={link.url} onChange={(e) => setProfileLinks((c) => c.map((item, i) => i === index ? { ...item, url: e.target.value } : item))} sx={{ flexGrow: 1 }} /><Button color="error" onClick={() => setProfileLinks((c) => c.filter((_, i) => i !== index))}>Delete</Button></Stack>)}<Button startIcon={<Add />} onClick={() => setProfileLinks((c) => [...c, { label: "", url: "" }])} disabled={profileLinks.length >= 20}>{t("accountPage.addProfileLink")}</Button></Stack>
                <Button type="submit" variant="contained" disabled={saving}>{saving ? t("accountPage.saving") : t("accountPage.saveProfile")}</Button>
            </Stack></CardContent></Card>
        </Stack> : tab === 1 ? <AccountPreferences /> : <DevicesSecurity />}
        <Stack direction="row" spacing={1}><Button variant="outlined" component="a" href="/dashboard/">{t("accountPage.dashboard")}</Button><Button component="a" href="/account/logout/">{t("accountPage.logOut")}</Button></Stack>
    </Stack></Page>;
}
const root = document.querySelector("#account-page"); if (root) createRoot(root).render(<App><AccountPage /></App>);
