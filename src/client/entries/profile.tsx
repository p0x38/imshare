import { PersonAdd, PersonRemove, HourglassEmpty } from "@mui/icons-material";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Link, List, ListItem, ListItemAvatar, ListItemText, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { LoadingState } from "../components/States";
import { ProfileLinks } from "../components/ProfileLinks";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Profile { id: string; name: string; handle?: string | null; bio?: string | null; avatarUrl?: string | null; profileBannerUrl?: string | null; websiteUrl?: string | null; githubUrl?: string | null; profileLinks?: Array<{ id: string; label: string; url: string }>; createdAt: string; allowSearchEngineIndex: boolean; stats: { posts: number; followers: number | null; following: number | null }; followStatus: "pending" | "approved" | null; isFollowing: boolean; canFollow: boolean; }
interface RelationshipUser { id: string; name: string; handle?: string | null; image?: string | null; avatarUrl: string; }

function RelationshipList({ value, kind }: { value: string; kind: "followers" | "following" }) {
    const [items, setItems] = useState<RelationshipUser[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
    useEffect(() => { setLoading(true); setError(""); void api<{ data: RelationshipUser[] }>(`/v1/users/${encodeURIComponent(value)}/${kind}?limit=100`).then((response) => setItems(response.data ?? [])).catch((cause) => setError(cause instanceof Error ? cause.message : `Unable to load ${kind}.`)).finally(() => setLoading(false)); }, [value, kind]);
    if (loading) return <LoadingState label={`Loading ${kind}…`} />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!items.length) return <Card variant="outlined"><CardContent><Typography color="text.secondary">No {kind} to show.</Typography></CardContent></Card>;
    return <Card variant="outlined"><List>{items.map((item, index) => <Box key={item.id}><ListItem component="a" href={item.handle ? `/users/@${encodeURIComponent(item.handle)}` : `/users/${encodeURIComponent(item.id)}`} sx={{ textDecoration: "none", color: "inherit" }}><ListItemAvatar><Avatar src={item.avatarUrl}>{item.name.charAt(0).toUpperCase()}</Avatar></ListItemAvatar><ListItemText primary={item.name} secondary={item.handle ? `@${item.handle}` : undefined} /></ListItem>{index < items.length - 1 ? <Divider component="li" /> : null}</Box>)}</List></Card>;
}

function ProfilePage() {
    const value = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "");
    const [profile, setProfile] = useState<Profile | null>(null); const [posts, setPosts] = useState<Post[]>([]); const [tab, setTab] = useState(0); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
    async function load() { try { const profileResponse = await api<{ data: Profile }>(`/v1/users/${encodeURIComponent(value)}/profile`); setProfile(profileResponse.data); if (profileResponse.data.stats.posts > 0) { const postsResponse = await api<{ data: Post[] }>(`/v1/users/${encodeURIComponent(value)}/posts?limit=100`); setPosts(postsResponse.data); } else setPosts([]); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load profile."); } }
    useEffect(() => { void load(); }, [value]);
    useEffect(() => { if (!profile) return; const existing = document.head.querySelector('meta[name="robots"]'); const meta = existing ?? document.createElement("meta"); meta.setAttribute("name", "robots"); meta.setAttribute("content", profile.allowSearchEngineIndex ? "index,follow" : "noindex,nofollow"); if (!existing) document.head.appendChild(meta); return () => { if (!existing) meta.remove(); }; }, [profile?.allowSearchEngineIndex]);
    async function toggleFollow() { if (!profile) return; setBusy(true); try { await api(`/v1/users/${encodeURIComponent(profile.id)}/follow`, { method: profile.followStatus ? "DELETE" : "POST" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update follow status."); } finally { setBusy(false); } }
    if (error && !profile) return <Page><Alert severity="error">{error}</Alert></Page>; if (!profile) return <Page><LoadingState label="Loading profile…" /></Page>;
    const pending = profile.followStatus === "pending";
    const tabs = [{ label: "Posts", visible: true }, { label: "About", visible: true }, { label: "Followers", visible: profile.stats.followers !== null }, { label: "Following", visible: profile.stats.following !== null }].filter((item) => item.visible);
    return <Page><Stack spacing={2}>
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
            {profile.profileBannerUrl ? <Box component="img" src={profile.profileBannerUrl} alt="" sx={{ width: "100%", height: { xs: 120, sm: 180 }, objectFit: "cover" }} /> : null}
            <CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Avatar src={profile.avatarUrl ?? undefined} sx={{ width: 96, height: 96 }}>{profile.name.charAt(0).toUpperCase()}</Avatar>
                <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}><Typography variant="h4" component="h1">{profile.name}</Typography>{profile.handle ? <Link href={`/users/@${encodeURIComponent(profile.handle)}`} underline="hover">@{profile.handle}</Link> : null}{profile.bio ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{profile.bio}</Typography> : null}</Stack>
                {profile.canFollow ? <Button variant={pending ? "outlined" : "contained"} startIcon={pending ? <HourglassEmpty /> : profile.isFollowing ? <PersonRemove /> : <PersonAdd />} onClick={() => void toggleFollow()} disabled={busy}>{pending ? "Requested" : profile.isFollowing ? "Following" : "Follow"}</Button> : null}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}><Chip label={`${profile.stats.posts.toLocaleString()} posts`} />{profile.stats.followers !== null ? <Chip label={`${profile.stats.followers.toLocaleString()} followers`} /> : null}{profile.stats.following !== null ? <Chip label={`${profile.stats.following.toLocaleString()} following`} /> : null}<Chip label={`Joined ${new Date(profile.createdAt).toLocaleDateString()}`} /></Stack>
            <ProfileLinks websiteUrl={profile.websiteUrl} githubUrl={profile.githubUrl} links={profile.profileLinks} />
            </CardContent>
        </Card>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Card variant="outlined"><Tabs value={Math.min(tab, tabs.length - 1)} onChange={(_, next) => setTab(next)} variant="scrollable" allowScrollButtonsMobile><Tab label="Posts" /> <Tab label="About" /> {profile.stats.followers !== null ? <Tab label={`Followers ${profile.stats.followers}`} /> : null} {profile.stats.following !== null ? <Tab label={`Following ${profile.stats.following}`} /> : null}</Tabs></Card>
        {tab === 0 ? <Stack spacing={1}>{posts.length ? <PostGrid posts={posts} /> : <Card variant="outlined"><CardContent><Typography color="text.secondary">No public posts.</Typography></CardContent></Card>}</Stack> : null}
        {tab === 1 ? <Card variant="outlined"><CardContent><Stack spacing={2}>{profile.bio ? <Box><Typography variant="subtitle2">About</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{profile.bio}</Typography></Box> : <Typography color="text.secondary">No profile description.</Typography>}{profile.websiteUrl || profile.githubUrl || profile.profileLinks?.length ? <ProfileLinks websiteUrl={profile.websiteUrl} githubUrl={profile.githubUrl} links={profile.profileLinks} /> : null}<Typography variant="body2" color="text.secondary">Joined {new Date(profile.createdAt).toLocaleDateString()}</Typography></Stack></CardContent></Card> : null}
        {tab === 2 && profile.stats.followers !== null ? <RelationshipList value={value} kind="followers" /> : null}
        {tab === 3 && profile.stats.following !== null ? <RelationshipList value={value} kind="following" /> : null}
    </Stack></Page>;
}
const root = document.querySelector("#profile-page"); if (root) createRoot(root).render(<App><ProfilePage /></App>);
