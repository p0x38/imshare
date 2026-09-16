import { PersonAdd, PersonRemove } from "@mui/icons-material";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { LoadingState } from "../components/States";
import { ProfileLinks } from "../components/ProfileLinks";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Profile {
    id: string;
    name: string;
    handle?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    profileBannerUrl?: string | null;
    websiteUrl?: string | null;
    githubUrl?: string | null;
    profileLinks?: Array<{ id: string; label: string; url: string }>;
    createdAt: string;
    stats: { posts: number; followers: number | null; following: number | null };
    isFollowing: boolean;
    canFollow: boolean;
}

function ProfilePage() {
    const value = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "");
    const [profile, setProfile] = useState<Profile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            const [profileResponse, postsResponse] = await Promise.all([
                api<{ data: Profile }>(`/v1/users/${encodeURIComponent(value)}/profile`),
                api<{ data: Post[] }>(`/v1/users/${encodeURIComponent(value)}/posts?limit=100`),
            ]);
            setProfile(profileResponse.data);
            setPosts(postsResponse.data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load profile.");
        }
    }
    useEffect(() => { void load(); }, [value]);

    async function toggleFollow() {
        if (!profile) return;
        setBusy(true);
        try {
            await api(`/v1/users/${encodeURIComponent(profile.id)}/follow`, { method: profile.isFollowing ? "DELETE" : "POST" });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to update follow status.");
        } finally { setBusy(false); }
    }

    if (error && !profile) return <Page><Alert severity="error">{error}</Alert></Page>;
    if (!profile) return <Page><LoadingState label="Loading profile…" /></Page>;

    return (
        <Page>
            <Stack spacing={2}>
                <Card variant="outlined" sx={{ overflow: "hidden" }}>
                    {profile.profileBannerUrl ? <Box component="img" src={profile.profileBannerUrl} alt="" sx={{ width: "100%", height: 180, objectFit: "cover" }} /> : null}
                    <CardContent>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
                            <Avatar src={profile.avatarUrl ?? undefined} sx={{ width: 96, height: 96 }}>{profile.name.charAt(0).toUpperCase()}</Avatar>
                            <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="h4" component="h1">{profile.name}</Typography>
                                {profile.handle ? <Typography color="text.secondary">@{profile.handle}</Typography> : null}
                                {profile.bio ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{profile.bio}</Typography> : null}
                            </Stack>
                            {profile.canFollow ? <Button variant="contained" startIcon={profile.isFollowing ? <PersonRemove /> : <PersonAdd />} onClick={() => void toggleFollow()} disabled={busy}>{profile.isFollowing ? "Following" : "Follow"}</Button> : null}
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                            <Chip label={`${profile.stats.posts.toLocaleString()} posts`} />
                            {profile.stats.followers !== null ? <Chip label={`${profile.stats.followers.toLocaleString()} followers`} component="a" clickable href={`/users/${profile.handle ? `@${encodeURIComponent(profile.handle)}` : encodeURIComponent(profile.id)}/followers/`} /> : null}
                            {profile.stats.following !== null ? <Chip label={`${profile.stats.following.toLocaleString()} following`} /> : null}
                            <Chip label={`Joined ${new Date(profile.createdAt).toLocaleDateString()}`} />
                        </Stack>
                        <ProfileLinks websiteUrl={profile.websiteUrl} githubUrl={profile.githubUrl} links={profile.profileLinks} />
                    </CardContent>
                </Card>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Stack spacing={1}>
                    <Typography variant="h5" component="h2">Posts</Typography>
                    {posts.length ? <PostGrid posts={posts} /> : <Card variant="outlined"><CardContent><Typography color="text.secondary">No public posts.</Typography></CardContent></Card>}
                </Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#profile-page");
if (root) createRoot(root).render(<App><ProfilePage /></App>);
