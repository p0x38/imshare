import { PersonAdd, PersonRemove, HourglassEmpty } from "@mui/icons-material";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Link,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Stack,
    Tab,
    Tabs,
    Typography,
    Pagination,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { TextList } from "../components/TextList";
import { UserBadges } from "../components/UserBadges";
import { LoadingState } from "../components/States";
import { ProfileLinks } from "../components/ProfileLinks";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface Profile {
    id: string;
    name: string;
    handle?: string | null;
    badges?: string[];
    bio?: string | null;
    avatarUrl?: string | null;
    profileBannerUrl?: string | null;
    websiteUrl?: string | null;
    githubUrl?: string | null;
    profileLinks?: Array<{ id: string; label: string; url: string }>;
    createdAt: string;
    allowSearchEngineIndex: boolean;
    stats: { posts: number; followers: number | null; following: number | null };
    followStatus: "pending" | "approved" | null;
    isFollowing: boolean;
    canFollow: boolean;
}
interface RelationshipUser {
    id: string;
    name: string;
    handle?: string | null;
    image?: string | null;
    avatarUrl: string;
    badges?: string[];
}
type ProfileTab = "posts" | "about" | "followers" | "following";

function RelationshipList({ value, kind }: { value: string; kind: "followers" | "following" }) {
    const [items, setItems] = useState<RelationshipUser[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        setLoading(true);
        setError("");
        void api<{ data: RelationshipUser[]; totalPages?: number }>(
            `/v1/users/${encodeURIComponent(value)}/${kind}?limit=50&page=${page}`,
        )
            .then((response) => { setItems(response.data ?? []); setTotalPages(response.totalPages ?? 1); })
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : `Unable to load ${kind}.`),
            )
            .finally(() => setLoading(false));
    }, [value, kind, page]);
    if (loading) return <LoadingState label={`Loading ${kind}…`} />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!items.length)
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography color="text.secondary">No {kind} to show.</Typography>
                </CardContent>
            </Card>
        );
    return (
        <Card variant="outlined">
            <List>
                {items.map((item, index) => (
                    <Box key={item.id}>
                        <ListItem
                            component="a"
                            href={
                                item.handle
                                    ? `/users/@${encodeURIComponent(item.handle)}`
                                    : `/users/${encodeURIComponent(item.id)}`
                            }
                            sx={{ textDecoration: "none", color: "inherit" }}
                        >
                            <ListItemAvatar>
                                <Avatar src={item.avatarUrl}>
                                    {item.name.charAt(0).toUpperCase()}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Stack
                                        direction="row"
                                        spacing={0.75}
                                        alignItems="center"
                                        flexWrap="wrap"
                                        useFlexGap
                                    >
                                        <Typography>{item.name}</Typography>
                                        <UserBadges user={item} compact />
                                    </Stack>
                                }
                                secondary={item.handle ? `@${item.handle}` : undefined}
                            />
                        </ListItem>
                        {index < items.length - 1 ? <Divider component="li" /> : null}
                    </Box>
                ))}
            </List>
            {totalPages > 1 ? <Stack alignItems="center" sx={{ p: 2 }}><Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} /></Stack> : null}
        </Card>
    );
}

function ProfilePage() {
    const value = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "");
    const [profile, setProfile] = useState<Profile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [postsPage, setPostsPage] = useState(1);
    const [postsTotalPages, setPostsTotalPages] = useState(1);
    const [tab, setTab] = useState<ProfileTab>("posts");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const imagePosts = posts.filter((post) => post.contentType !== "text");
    const texts = posts.filter((post) => post.contentType === "text");
    async function load() {
        try {
            const profileResponse = await api<{ data: Profile }>(
                `/v1/users/${encodeURIComponent(value)}/profile`,
            );
            setProfile(profileResponse.data);
            if (profileResponse.data.stats.posts > 0) {
                const postsResponse = await api<{ data: Post[]; pagination?: { totalPages?: number } }>(
                    `/v1/users/${encodeURIComponent(value)}/posts?limit=48&page=${postsPage}`,
                );
                setPosts(postsResponse.data); setPostsTotalPages(postsResponse.pagination?.totalPages ?? 1);
            } else setPosts([]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load profile.");
        }
    }
    useEffect(() => {
        void load();
    }, [value, postsPage]);
    useEffect(() => {
        if (!profile) return;
        const existing = document.head.querySelector('meta[name="robots"]');
        const meta = existing ?? document.createElement("meta");
        meta.setAttribute("name", "robots");
        meta.setAttribute(
            "content",
            profile.allowSearchEngineIndex ? "index,follow" : "noindex,nofollow",
        );
        if (!existing) document.head.appendChild(meta);
        return () => {
            if (!existing) meta.remove();
        };
    }, [profile?.allowSearchEngineIndex]);
    async function toggleFollow() {
        if (!profile) return;
        setBusy(true);
        try {
            await api(`/v1/users/${encodeURIComponent(profile.id)}/follow`, {
                method: profile.followStatus ? "DELETE" : "POST",
            });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to update follow status.");
        } finally {
            setBusy(false);
        }
    }
    if (error && !profile)
        return (
            <Page>
                <Alert severity="error">{error}</Alert>
            </Page>
        );
    if (!profile)
        return (
            <Page>
                <LoadingState label="Loading profile…" />
            </Page>
        );
    const visibleTabs: Array<{ value: ProfileTab; label: string }> = [
        { value: "posts", label: "Posts" },
        { value: "about", label: "About" },
        ...(profile.stats.followers !== null
            ? [{ value: "followers" as const, label: `Followers ${profile.stats.followers}` }]
            : []),
        ...(profile.stats.following !== null
            ? [{ value: "following" as const, label: `Following ${profile.stats.following}` }]
            : []),
    ];
    const validTab = visibleTabs.some((item) => item.value === tab) ? tab : "posts";
    return (
        <Page>
            <Stack spacing={2}>
                <Card variant="outlined" sx={{ overflow: "hidden" }}>
                    {profile.profileBannerUrl ? (
                        <Box
                            component="img"
                            src={profile.profileBannerUrl}
                            alt=""
                            sx={{ width: "100%", height: { xs: 120, sm: 180 }, objectFit: "cover" }}
                        />
                    ) : null}
                    <CardContent>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                            <Avatar
                                src={profile.avatarUrl ?? undefined}
                                sx={{ width: 96, height: 96 }}
                            >
                                {profile.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Stack spacing={0.75}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        flexWrap="wrap"
                                        useFlexGap
                                    >
                                        <Typography variant="h4" component="h1">
                                            {profile.name}
                                        </Typography>
                                        <UserBadges user={profile} />
                                    </Stack>
                                </Stack>
                                {profile.handle ? (
                                    <Link
                                        href={`/users/@${encodeURIComponent(profile.handle)}`}
                                        underline="hover"
                                    >
                                        @{profile.handle}
                                    </Link>
                                ) : null}
                                {profile.bio ? (
                                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                                        {profile.bio}
                                    </Typography>
                                ) : null}
                            </Stack>
                            {profile.canFollow ? (
                                <Button
                                    variant={
                                        pending(profile.followStatus) ? "outlined" : "contained"
                                    }
                                    startIcon={
                                        pending(profile.followStatus) ? (
                                            <HourglassEmpty />
                                        ) : profile.isFollowing ? (
                                            <PersonRemove />
                                        ) : (
                                            <PersonAdd />
                                        )
                                    }
                                    onClick={() => void toggleFollow()}
                                    disabled={busy}
                                >
                                    {pending(profile.followStatus)
                                        ? "Requested"
                                        : profile.isFollowing
                                          ? "Following"
                                          : "Follow"}
                                </Button>
                            ) : null}
                        </Stack>
                        <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: 2 }}
                        >
                            <Chip label={`${profile.stats.posts.toLocaleString()} posts`} />
                            {profile.stats.followers !== null ? (
                                <Chip
                                    label={`${profile.stats.followers.toLocaleString()} followers`}
                                />
                            ) : null}
                            {profile.stats.following !== null ? (
                                <Chip
                                    label={`${profile.stats.following.toLocaleString()} following`}
                                />
                            ) : null}
                            <Chip
                                label={`Joined ${new Date(profile.createdAt).toLocaleDateString()}`}
                            />
                        </Stack>
                        <ProfileLinks
                            websiteUrl={profile.websiteUrl}
                            githubUrl={profile.githubUrl}
                            links={profile.profileLinks}
                        />
                    </CardContent>
                </Card>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Card variant="outlined">
                    <Tabs
                        value={validTab}
                        onChange={(_, next: ProfileTab) => setTab(next)}
                        variant="scrollable"
                        allowScrollButtonsMobile
                    >
                        {visibleTabs.map((item) => (
                            <Tab key={item.value} value={item.value} label={item.label} />
                        ))}
                    </Tabs>
                </Card>
                {validTab === "posts" ? (
                    <Stack spacing={{ xs: 3, sm: 4 }}>
                        {imagePosts.length ? (
                            <Stack spacing={1.5}>
                                <Typography variant="h5" component="h2">
                                    Posts
                                </Typography>
                                <PostGrid posts={imagePosts} />
                            </Stack>
                        ) : null}
                        {postsTotalPages > 1 ? <Pagination count={postsTotalPages} page={postsPage} onChange={(_, value) => setPostsPage(value)} /> : null}
                        {texts.length ? (
                            <Stack spacing={1.5}>
                                <Typography variant="h5" component="h2">
                                    Texts
                                </Typography>
                                <TextList texts={texts} />
                            </Stack>
                        ) : null}
                        {!imagePosts.length && !texts.length ? (
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography color="text.secondary">No public posts.</Typography>
                                </CardContent>
                            </Card>
                        ) : null}
                    </Stack>
                ) : null}
                {validTab === "about" ? (
                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                {profile.bio ? (
                                    <Box>
                                        <Typography variant="subtitle2">About</Typography>
                                        <Typography sx={{ whiteSpace: "pre-wrap" }}>
                                            {profile.bio}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography color="text.secondary">
                                        No profile description.
                                    </Typography>
                                )}
                                {profile.websiteUrl ||
                                profile.githubUrl ||
                                profile.profileLinks?.length ? (
                                    <ProfileLinks
                                        websiteUrl={profile.websiteUrl}
                                        githubUrl={profile.githubUrl}
                                        links={profile.profileLinks}
                                    />
                                ) : null}
                                <Typography variant="body2" color="text.secondary">
                                    Joined {new Date(profile.createdAt).toLocaleDateString()}
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                ) : null}
                {validTab === "followers" && profile.stats.followers !== null ? (
                    <RelationshipList value={value} kind="followers" />
                ) : null}
                {validTab === "following" && profile.stats.following !== null ? (
                    <RelationshipList value={value} kind="following" />
                ) : null}
            </Stack>
        </Page>
    );
}
function pending(status: Profile["followStatus"]) {
    return status === "pending";
}
const root = document.querySelector("#profile-page");
if (root)
    createRoot(root).render(
        <App>
            <ProfilePage />
        </App>,
    );
