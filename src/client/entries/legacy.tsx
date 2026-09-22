import {
    Alert,
    Autocomplete,
    Avatar,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { LoadingState } from "../components/States";
import { SearchAutocomplete } from "../components/AutocompleteFields";
import { api } from "../lib/api";
import type { Post, User } from "../lib/types";

type RouteKind =
    | "login"
    | "register"
    | "notifications"
    | "profile"
    | "users"
    | "user"
    | "user-posts"
    | "tags"
    | "tag"
    | "tag-posts"
    | "categories"
    | "category"
    | "category-posts"
    | "search"
    | "about"
    | "faq"
    | "github"
    | "privacy"
    | "terms"
    | "admin";

function route(): { kind: RouteKind; id?: string } {
    const path = location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (path === "/account/login") return { kind: "login" };
    if (path === "/account/register") return { kind: "register" };
    if (path === "/account/notifications" || path === "/notifications")
        return { kind: "notifications" };
    if (path === "/account/profile") return { kind: "profile" };
    if (path === "/users") return { kind: "users" };
    if (parts[0] === "users" && parts[2] === "posts") return { kind: "user-posts", id: parts[1] };
    if (parts[0] === "users" && parts[1]) return { kind: "user", id: parts[1] };
    if (path === "/tags") return { kind: "tags" };
    if (parts[0] === "tags" && parts[2] === "posts") return { kind: "tag-posts", id: parts[1] };
    if (parts[0] === "tags" && parts[1]) return { kind: "tag", id: parts[1] };
    if (path === "/categories") return { kind: "categories" };
    if (parts[0] === "categories" && parts[2] === "posts")
        return { kind: "category-posts", id: parts[1] };
    if (parts[0] === "categories" && parts[1]) return { kind: "category", id: parts[1] };
    if (path === "/search") return { kind: "search" };
    if (path === "/about") return { kind: "about" };
    if (path === "/faq") return { kind: "faq" };
    if (path === "/github") return { kind: "github" };
    if (path === "/privacy") return { kind: "privacy" };
    if (path === "/terms") return { kind: "terms" };
    if (path === "/admin") return { kind: "admin" };
    throw new Error(`Unsupported legacy route: ${location.pathname}`);
}

function PageCards({ posts }: { posts: Post[] }) {
    return <PostGrid posts={posts} />;
}

function AuthPage({ register }: { register: boolean }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api(register ? "/v1/auth/sign-up/email" : "/v1/auth/sign-in/email", {
                method: "POST",
                body: JSON.stringify(
                    register
                        ? { name, email, password, registrationToken: token.trim() }
                        : { email, password },
                ),
            });
            location.href = "/dashboard/";
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : register
                      ? "Registration failed."
                      : "Login failed.",
            );
        } finally {
            setLoading(false);
        }
    }
    return (
        <Page maxWidth="sm">
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {register ? "Create account" : "Log in"}
                </Typography>
                <Card variant="outlined">
                    <CardContent>
                        <Stack component="form" spacing={2} onSubmit={submit}>
                            <TextField
                                label={register ? "Name" : "Email"}
                                type={register ? "text" : "email"}
                                value={register ? name : email}
                                onChange={(e) =>
                                    register ? setName(e.target.value) : setEmail(e.target.value)
                                }
                                required
                            />
                            {register ? (
                                <TextField
                                    label="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            ) : null}
                            <TextField
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {register ? (
                                <>
                                    <TextField
                                        label="Registration access token"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        autoComplete="one-time-code"
                                        required
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Ask the server owner for the current registration token. It
                                        rotates every 12 hours.
                                    </Typography>
                                </>
                            ) : null}
                            {error ? <Alert severity="error">{error}</Alert> : null}
                            <Button type="submit" variant="contained" disabled={loading}>
                                {loading ? "Working…" : register ? "Create account" : "Log in"}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <Typography>
                    {register ? (
                        <>
                            Already registered? <a href="/account/login/">Log in</a>.
                        </>
                    ) : (
                        <>
                            No account? <a href="/account/register/">Create one</a>.
                        </>
                    )}
                </Typography>
            </Stack>
        </Page>
    );
}

function NotificationsPage() {
    interface Notification {
        id: string;
        message: string;
        createdAt: string;
        readAt?: string | null;
        postId?: string | null;
    }
    const [items, setItems] = useState<Notification[] | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const load = async () => {
        try {
            const result = await api<{ data: Notification[]; pagination: { total: number } }>(
                "/v1/me/notifications?limit=100",
            );
            setItems(result.data);
        } catch (cause) {
            const status = (cause as Error & { status?: number }).status;
            setError(
                status === 401
                    ? "Please sign in."
                    : cause instanceof Error
                      ? cause.message
                      : "Unable to load notifications.",
            );
        }
    };
    useEffect(() => {
        void load();
    }, []);
    const unread = items?.filter((x) => !x.readAt).length ?? 0;
    async function mark(id: string) {
        setBusy(id);
        try {
            await api(`/v1/me/notifications/${id}/read`, {
                method: "PATCH",
                body: JSON.stringify({}),
            });
            await load();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "Unable to mark notification as read.",
            );
        } finally {
            setBusy(null);
        }
    }
    async function markAll() {
        setBusy("all");
        try {
            await api("/v1/me/notifications/read-all", { method: "POST" });
            await load();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "Unable to mark notifications as read.",
            );
        } finally {
            setBusy(null);
        }
    }
    return (
        <Page>
            <Stack spacing={2}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={1}
                >
                    <Typography variant="h4" component="h1">
                        Notifications
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => void markAll()}
                        disabled={!unread || busy !== null}
                    >
                        {busy === "all" ? "Marking…" : "Mark all as read"}
                    </Button>
                </Stack>
                {error ? <Alert severity="error">{error}</Alert> : null}
                {items === null ? (
                    <LoadingState label="Loading notifications…" />
                ) : items.length ? (
                    <Stack spacing={1}>
                        {items.map((item) => (
                            <Card
                                key={item.id}
                                variant="outlined"
                                sx={{ borderColor: item.readAt ? undefined : "primary.main" }}
                            >
                                <CardContent>
                                    <Stack spacing={1}>
                                        <Typography>{item.message}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {new Date(item.createdAt).toLocaleString()}{" "}
                                            {!item.readAt ? "· unread" : null}
                                        </Typography>
                                        <Stack direction="row" spacing={1}>
                                            {item.postId ? (
                                                <Button
                                                    size="small"
                                                    component="a"
                                                    href={`/posts/${encodeURIComponent(item.postId)}`}
                                                >
                                                    Open post
                                                </Button>
                                            ) : null}
                                            {!item.readAt ? (
                                                <Button
                                                    size="small"
                                                    disabled={busy === item.id}
                                                    onClick={() => void mark(item.id)}
                                                >
                                                    Mark read
                                                </Button>
                                            ) : null}
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                ) : (
                    <Card variant="outlined">
                        <CardContent>
                            <Typography>No notifications yet.</Typography>
                        </CardContent>
                    </Card>
                )}
            </Stack>
        </Page>
    );
}

function ProfileSettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [avatarMode, setAvatarMode] = useState("initials");
    const [avatarValue, setAvatarValue] = useState("");
    const [banner, setBanner] = useState("");
    const [accent, setAccent] = useState("#0645ad");
    useEffect(() => {
        void api<{ data: User }>("/v1/me")
            .then((r) => {
                setUser(r.data);
                setAvatarMode(r.data.avatarMode || "initials");
                setAvatarValue(r.data.avatarValue || "");
                setBanner(r.data.profileBannerUrl || "");
                setAccent(r.data.accentColor || "#0645ad");
            })
            .catch((e) =>
                setError(
                    (e as Error & { status?: number }).status === 401
                        ? "Please sign in."
                        : e instanceof Error
                          ? e.message
                          : "Unable to load profile settings.",
                ),
            );
    }, []);
    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        setError("");
        try {
            await api(`/v1/users/${encodeURIComponent(user.id)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    avatarMode,
                    avatarValue: avatarValue || null,
                    profileBannerUrl: banner || null,
                    accentColor: accent,
                }),
            });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save profile settings.");
        } finally {
            setSaving(false);
        }
    }
    if (!user)
        return (
            <Page maxWidth="sm">
                {error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <LoadingState label="Loading profile settings…" />
                )}
            </Page>
        );
    return (
        <Page maxWidth="sm">
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    Profile settings
                </Typography>
                <Card variant="outlined">
                    <CardContent>
                        <Stack component="form" spacing={2} onSubmit={save}>
                            <FormControl fullWidth>
                                <InputLabel id="avatar-mode">Avatar mode</InputLabel>
                                <Select
                                    labelId="avatar-mode"
                                    label="Avatar mode"
                                    value={avatarMode}
                                    onChange={(e) => setAvatarMode(e.target.value)}
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
                                value={avatarValue}
                                onChange={(e) => setAvatarValue(e.target.value)}
                            />
                            <TextField
                                label="Profile banner URL"
                                type="url"
                                value={banner}
                                onChange={(e) => setBanner(e.target.value)}
                                inputProps={{ maxLength: 2048 }}
                            />
                            <Stack direction="row" alignItems="center" spacing={2}>
                                <TextField
                                    label="Accent color"
                                    type="color"
                                    value={accent}
                                    onChange={(e) => setAccent(e.target.value)}
                                    sx={{ width: 140 }}
                                />
                                <Typography color="text.secondary">{accent}</Typography>
                            </Stack>
                            {error ? <Alert severity="error">{error}</Alert> : null}
                            <Button type="submit" variant="contained" disabled={saving}>
                                {saving ? "Saving…" : "Save settings"}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Page>
    );
}

function EntityListPage({ taxonomy }: { taxonomy: "users" | "tags" | "categories" }) {
    const [items, setItems] = useState<Array<Record<string, unknown>> | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        void api<{ data: Array<Record<string, unknown>> }>(`/v1/${taxonomy}?limit=100`)
            .then((r) => setItems(r.data))
            .catch((e) => setError(e instanceof Error ? e.message : `Unable to load ${taxonomy}.`));
    }, [taxonomy]);
    const label = taxonomy[0]!.toUpperCase() + taxonomy.slice(1);
    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {label}
                </Typography>
                {error ? <Alert severity="error">{error}</Alert> : null}
                {items === null ? (
                    <LoadingState label={`Loading ${taxonomy}…`} />
                ) : items.length === 0 ? (
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: "center", py: 5 }}>
                            <Typography variant="h5" gutterBottom>
                                Not yet created
                            </Typography>
                            <Typography color="text.secondary">
                                It seems {label.toLowerCase()} is not created yet.
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <Stack spacing={1.5}>
                        {items.map((item) => {
                            const id = String(item.id);
                            const name = String(item.name ?? id);
                            const count = Number(
                                (item._count as { posts?: number } | undefined)?.posts ?? 0,
                            );
                            const bannerUrl = typeof item.bannerUrl === "string" ? item.bannerUrl : null;
                            const avatarUrl = typeof item.avatarUrl === "string" ? item.avatarUrl : null;
                            return (
                                <Card key={id} variant="outlined" sx={{ overflow: "hidden" }}>
                                    <CardActionArea
                                        component="a"
                                        href={`/${taxonomy}/${encodeURIComponent(id)}`}
                                    >
                                        {bannerUrl ? (
                                            <Box
                                                component="img"
                                                src={bannerUrl}
                                                alt=""
                                                sx={{ display: "block", width: "100%", height: 120, objectFit: "cover" }}
                                            />
                                        ) : null}
                                        <CardContent>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                {taxonomy === "users" ? (
                                                    <Avatar src={avatarUrl ?? undefined}>
                                                        {name.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                ) : null}
                                                <Box>
                                                    <Typography variant="h6">{name}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {count} post{count === 1 ? "" : "s"}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            );
                        })}
                    </Stack>
                )}
            </Stack>
        </Page>
    );
}

function EntityPostsPage({
    taxonomy,
    id,
}: {
    taxonomy: "users" | "tags" | "categories";
    id: string;
}) {
    const [posts, setPosts] = useState<Post[] | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        void api<{ data?: Post[] }>(`/v1/${taxonomy}/${encodeURIComponent(id)}/posts?limit=100`)
            .then((r) => setPosts(r.data ?? []))
            .catch((e) => setError(e instanceof Error ? e.message : "Unable to load posts."));
    }, [taxonomy, id]);
    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {taxonomy === "users"
                        ? "User Posts"
                        : taxonomy === "tags"
                          ? "Tagged Posts"
                          : "Category Posts"}
                </Typography>
                {error ? (
                    <Alert severity="error">{error}</Alert>
                ) : posts === null ? (
                    <LoadingState label="Loading posts…" />
                ) : (
                    <PageCards posts={posts} />
                )}
            </Stack>
        </Page>
    );
}

function EntityPage({ taxonomy, id }: { taxonomy: "users" | "tags" | "categories"; id: string }) {
    const [entity, setEntity] = useState<Record<string, unknown> | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        void Promise.all([
            api<{ data: Record<string, unknown> }>(`/v1/${taxonomy}/${encodeURIComponent(id)}`),
            api<{ data?: Post[] }>(`/v1/${taxonomy}/${encodeURIComponent(id)}/posts?limit=100`),
        ])
            .then(([a, p]) => {
                setEntity(a.data);
                setPosts(p.data ?? []);
            })
            .catch((e) =>
                setError(e instanceof Error ? e.message : `${taxonomy.slice(0, -1)} not found.`),
            );
    }, [taxonomy, id]);
    if (error)
        return (
            <Page>
                <Alert severity="error">{error}</Alert>
            </Page>
        );
    if (!entity)
        return (
            <Page>
                <LoadingState />
            </Page>
        );
    if (taxonomy === "users") {
        const u = entity as unknown as User & {
            _count?: { posts?: number };
            profileBannerUrl?: string;
            accentColor?: string;
        };
        return (
            <Page>
                <Stack spacing={2}>
                    <Card variant="outlined" sx={{ overflow: "hidden" }}>
                        {u.profileBannerUrl ? (
                            <Box
                                component="img"
                                src={u.profileBannerUrl}
                                sx={{ width: "100%", maxHeight: 280, objectFit: "cover" }}
                            />
                        ) : null}
                        <CardContent>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar
                                    src={u.avatarUrl ?? undefined}
                                    sx={{ width: 72, height: 72 }}
                                >
                                    {(u.name || "U").charAt(0).toUpperCase()}
                                </Avatar>
                                <Stack>
                                    <Typography variant="h4" component="h1">
                                        {u.name}
                                    </Typography>
                                    <Typography color="text.secondary">
                                        {u._count?.posts ?? posts.length} post
                                        {(u._count?.posts ?? posts.length) === 1 ? "" : "s"} ·
                                        Joined{" "}
                                        {u.createdAt
                                            ? new Date(u.createdAt).toLocaleDateString()
                                            : ""}
                                    </Typography>
                                </Stack>
                            </Stack>
                            {u.bio ? <Typography sx={{ mt: 2 }}>{u.bio}</Typography> : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
                                {u.websiteUrl ? (
                                    <Chip
                                        component="a"
                                        clickable
                                        label="Website"
                                        href={u.websiteUrl}
                                    />
                                ) : null}
                                {u.githubUrl ? (
                                    <Chip
                                        component="a"
                                        clickable
                                        label="GitHub"
                                        href={u.githubUrl}
                                    />
                                ) : null}
                                {(u.profileLinks ?? []).map((l) => (
                                    <Chip
                                        key={l.id}
                                        component="a"
                                        clickable
                                        label={l.label}
                                        href={l.url}
                                    />
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                    <PageCards posts={posts.slice(0, 6)} />
                </Stack>
            </Page>
        );
    }
    const name = String(entity.name ?? id);
    const bannerUrl = typeof entity.bannerUrl === "string" ? entity.bannerUrl : null;
    return (
        <Page>
            <Stack spacing={2}>
                <Card variant="outlined" sx={{ overflow: "hidden" }}>
                    {bannerUrl ? (
                        <Box
                            component="img"
                            src={bannerUrl}
                            alt=""
                            sx={{ display: "block", width: "100%", height: { xs: 140, sm: 220 }, objectFit: "cover" }}
                        />
                    ) : null}
                    <CardContent>
                        <Typography variant="h4" component="h1">
                            {name}
                        </Typography>
                        <Typography color="text.secondary">
                            {posts.length} post{posts.length === 1 ? "" : "s"}
                        </Typography>
                    </CardContent>
                </Card>
                {posts.length ? (
                    <PageCards posts={posts} />
                ) : (
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: "center", py: 5 }}>
                            <Typography variant="h5" gutterBottom>
                                Not yet created
                            </Typography>
                            <Typography color="text.secondary">
                                It seems no posts are created for this {taxonomy === "tags" ? "tag" : "category"} yet.
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </Stack>
        </Page>
    );
}

function SearchPage() {
    const [query, setQuery] = useState(new URLSearchParams(location.search).get("q") ?? "");
    const [submitted, setSubmitted] = useState(query);
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        if (!submitted.trim()) {
            setPosts([]);
            return;
        }
        void api<{ data?: Post[] }>(
            `/v1/search?q=${encodeURIComponent(submitted.trim())}&type=all&limit=25`,
        )
            .then((r) => setPosts(r.data ?? []))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Search failed."));
    }, [submitted]);
    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    Search
                </Typography>
                <Stack
                    component="form"
                    direction="row"
                    spacing={1}
                    onSubmit={(e) => {
                        e.preventDefault();
                        setSubmitted(query);
                    }}
                >
                    <SearchAutocomplete
                        value={query}
                        onChange={setQuery}
                        onSubmit={() => setSubmitted(query)}
                        fullWidth
                    />
                    <Button type="submit" variant="contained">
                        Search
                    </Button>
                </Stack>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <PageCards posts={posts} />
            </Stack>
        </Page>
    );
}

function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {title}
                </Typography>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>{children}</Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Page>
    );
}

function AdminPage() {
    const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [gaId, setGaId] = useState("");
    const [gtmId, setGtmId] = useState("");
    const [savingAnalytics, setSavingAnalytics] = useState(false);
    const [analyticsSaved, setAnalyticsSaved] = useState(false);
    useEffect(() => {
        void api<{ data: Record<string, unknown> }>("/v1/admin/overview")
            .then((r) => setOverview(r.data))
            .catch((cause) =>
                setError(cause instanceof Error ? cause.message : "Unable to load admin overview."),
            );
        void api<{
            data: { googleAnalyticsMeasurementId: string; googleTagManagerContainerId: string };
        }>("/v1/admin/analytics")
            .then((r) => {
                setGaId(r.data.googleAnalyticsMeasurementId);
                setGtmId(r.data.googleTagManagerContainerId);
            })
            .catch((cause) =>
                setError(
                    cause instanceof Error ? cause.message : "Unable to load analytics settings.",
                ),
            );
    }, []);
    async function rotateToken() {
        try {
            const r = await api<{ data?: { token?: string } }>("/v1/admin/registration-token", {
                method: "POST",
            });
            setToken(r.data?.token ?? "");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to rotate token.");
        }
    }
    async function saveAnalytics(event: React.FormEvent) {
        event.preventDefault();
        setSavingAnalytics(true);
        setAnalyticsSaved(false);
        setError("");
        try {
            const r = await api<{
                data: { googleAnalyticsMeasurementId: string; googleTagManagerContainerId: string };
            }>("/v1/admin/analytics", {
                method: "PATCH",
                body: JSON.stringify({
                    googleAnalyticsMeasurementId: gaId,
                    googleTagManagerContainerId: gtmId,
                }),
            });
            setGaId(r.data.googleAnalyticsMeasurementId);
            setGtmId(r.data.googleTagManagerContainerId);
            setAnalyticsSaved(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save analytics settings.");
        } finally {
            setSavingAnalytics(false);
        }
    }
    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    Admin
                </Typography>
                {error ? <Alert severity="error">{error}</Alert> : null}
                {overview ? (
                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={1}>
                                {Object.entries(overview).map(([key, value]) => (
                                    <Typography key={key}>
                                        <strong>{key}:</strong>{" "}
                                        {typeof value === "object"
                                            ? JSON.stringify(value)
                                            : String(value)}
                                    </Typography>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                ) : (
                    <LoadingState />
                )}
                <Card variant="outlined">
                    <CardContent>
                        <Stack component="form" spacing={2} onSubmit={saveAnalytics}>
                            <Typography variant="h6" component="h2">
                                Google analytics
                            </Typography>
                            <TextField
                                label="Google Analytics measurement ID"
                                placeholder="G-XXXXXXXXXX"
                                value={gaId}
                                onChange={(e) => setGaId(e.target.value)}
                                helperText="Leave empty to disable Google Analytics."
                            />
                            <TextField
                                label="Google Tag Manager container ID"
                                placeholder="GTM-XXXXXXX"
                                value={gtmId}
                                onChange={(e) => setGtmId(e.target.value)}
                                helperText="Leave empty to disable Google Tag Manager."
                            />
                            {analyticsSaved ? (
                                <Alert severity="success">
                                    Analytics settings saved. Restart the server to apply them to
                                    pages.
                                </Alert>
                            ) : null}
                            <Button type="submit" variant="contained" disabled={savingAnalytics}>
                                {savingAnalytics ? "Saving…" : "Save analytics settings"}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                {token ? (
                    <Alert severity="warning">
                        New registration token: <code>{token}</code>
                    </Alert>
                ) : null}
                <Button variant="contained" onClick={() => void rotateToken()}>
                    Rotate registration token
                </Button>
            </Stack>
        </Page>
    );
}

function LegacyPage() {
    const current = route();
    if (current.kind === "login") return <AuthPage register={false} />;
    if (current.kind === "register") return <AuthPage register />;
    if (current.kind === "notifications") return <NotificationsPage />;
    if (current.kind === "profile") return <ProfileSettingsPage />;
    if (current.kind === "users" || current.kind === "tags" || current.kind === "categories")
        return <EntityListPage taxonomy={current.kind} />;
    if (current.kind === "user" || current.kind === "tag" || current.kind === "category")
        return (
            <EntityPage
                taxonomy={
                    current.kind === "user"
                        ? "users"
                        : current.kind === "tag"
                          ? "tags"
                          : "categories"
                }
                id={current.id!}
            />
        );
    if (
        current.kind === "user-posts" ||
        current.kind === "tag-posts" ||
        current.kind === "category-posts"
    )
        return (
            <EntityPostsPage
                taxonomy={
                    current.kind === "user-posts"
                        ? "users"
                        : current.kind === "tag-posts"
                          ? "tags"
                          : "categories"
                }
                id={current.id!}
            />
        );
    if (current.kind === "search") return <SearchPage />;
    if (current.kind === "admin") return <AdminPage />;
    if (current.kind === "about")
        return (
            <StaticPage title="About">
                <Typography>imshare is a self-hosted image archive and sharing server.</Typography>
            </StaticPage>
        );
    if (current.kind === "faq")
        return (
            <Page maxWidth="md">
                <Stack spacing={3}>
                    <Typography variant="h4" component="h1">
                        FAQs
                    </Typography>
                    <Stack spacing={2}>
                        <Typography variant="h5" component="h2">
                            About imshare
                        </Typography>
                        <Typography>
                            imshare is a self-hosted image archive and sharing server.
                        </Typography>
                    </Stack>
                    <Stack spacing={2}>
                        <Typography variant="h5" component="h2">
                            Images and privacy
                        </Typography>
                        <Typography variant="h6" component="h3">
                            Who can access my images?
                        </Typography>
                        <Typography>
                            Access depends on the sharing settings and policies configured by the
                            server operator.
                        </Typography>
                    </Stack>
                </Stack>
            </Page>
        );
    if (current.kind === "github")
        return (
            <StaticPage title="GitHub">
                <Typography>
                    Source code and project information are maintained by the server owner.
                </Typography>
            </StaticPage>
        );
    if (current.kind === "privacy")
        return (
            <StaticPage title="Privacy">
                <Typography>
                    Review the server operator's privacy policy for retention and access details.
                </Typography>
            </StaticPage>
        );
    return (
        <StaticPage title="Terms">
            <Typography>
                Use this service responsibly and follow the server operator's rules.
            </Typography>
        </StaticPage>
    );
}

const root = document.querySelector("#legacy-page");
if (root)
    createRoot(root).render(
        <App>
            <LegacyPage />
        </App>,
    );
