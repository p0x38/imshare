import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { PostGrid } from "../components/PostGrid";
import { LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { Post, User } from "../lib/types";

type RouteKind =
    | "login" | "register" | "notifications" | "profile"
    | "users" | "user" | "user-posts" | "tags" | "tag" | "tag-posts"
    | "categories" | "category" | "category-posts" | "search"
    | "about" | "faq" | "github" | "privacy" | "terms" | "admin";

function route(): { kind: RouteKind; id?: string } {
    const path = location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (path === "/account/login") return { kind: "login" };
    if (path === "/account/register") return { kind: "register" };
    if (path === "/account/notifications" || path === "/notifications") return { kind: "notifications" };
    if (path === "/account/profile") return { kind: "profile" };
    if (path === "/users") return { kind: "users" };
    if (parts[0] === "users" && parts[2] === "posts") return { kind: "user-posts", id: parts[1] };
    if (parts[0] === "users" && parts[1]) return { kind: "user", id: parts[1] };
    if (path === "/tags") return { kind: "tags" };
    if (parts[0] === "tags" && parts[2] === "posts") return { kind: "tag-posts", id: parts[1] };
    if (parts[0] === "tags" && parts[1]) return { kind: "tag", id: parts[1] };
    if (path === "/categories") return { kind: "categories" };
    if (parts[0] === "categories" && parts[2] === "posts") return { kind: "category-posts", id: parts[1] };
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
        setError(""); setLoading(true);
        try {
            await api(register ? "/v1/auth/sign-up/email" : "/v1/auth/sign-in/email", {
                method: "POST",
                body: JSON.stringify(register ? { name, email, password, registrationToken: token.trim() } : { email, password }),
            });
            location.href = "/dashboard/";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : register ? "Registration failed." : "Login failed.");
        } finally { setLoading(false); }
    }

    return <Page maxWidth="sm"><Stack spacing={2}><Typography variant="h4" component="h1">{register ? "Create account" : "Log in"}</Typography><Card variant="outlined"><CardContent><Stack component="form" spacing={2} onSubmit={submit}><TextField label={register ? "Name" : "Email"} type={register ? "text" : "email"} value={register ? name : email} onChange={(e) => register ? setName(e.target.value) : setEmail(e.target.value)} required />{register ? <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /> : null}<TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />{register ? <><TextField label="Registration access token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="one-time-code" required /><Typography variant="body2" color="text.secondary">Ask the server owner for the current registration token. It rotates every 12 hours.</Typography></> : null}{error ? <Alert severity="error">{error}</Alert> : null}<Button type="submit" variant="contained" disabled={loading}>{loading ? "Working…" : register ? "Create account" : "Log in"}</Button></Stack></CardContent></Card><Typography>{register ? <>Already registered? <a href="/account/login/">Log in</a>.</> : <>No account? <a href="/account/register/">Create one</a>.</>}</Typography></Stack></Page>;
}

function NotificationsPage() {
    interface Notification { id: string; message: string; createdAt: string; readAt?: string | null; postId?: string | null }
    const [items, setItems] = useState<Notification[] | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const load = async () => {
        try { const result = await api<{ data: Notification[]; pagination: { total: number } }>("/v1/me/notifications?limit=100"); setItems(result.data); }
        catch (cause) { const status = (cause as Error & { status?: number }).status; setError(status === 401 ? "Please sign in." : cause instanceof Error ? cause.message : "Unable to load notifications."); }
    };
    useEffect(() => { void load(); }, []);
    useEffect(() => {
        const script = document.createElement("script"); script.src = "/socket.io/socket.io.js"; script.onload = () => {
            const io = (window as typeof window & { io?: () => { on: (event: string, cb: () => void) => void; disconnect?: () => void } }).io;
            const socket = io?.(); socket?.on("notification", () => void load());
        }; document.head.append(script); return () => script.remove();
    }, []);
    const unread = items?.filter((x) => !x.readAt).length ?? 0;
    async function mark(id: string) { setBusy(id); try { await api(`/v1/me/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to mark notification as read."); } finally { setBusy(null); } }
    async function markAll() { setBusy("all"); try { await api("/v1/me/notifications/read-all", { method: "POST" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to mark notifications as read."); } finally { setBusy(null); } }
    return <Page><Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}><Typography variant="h4" component="h1">Notifications</Typography><Button variant="contained" onClick={() => void markAll()} disabled={!unread || busy !== null}>{busy === "all" ? "Marking…" : "Mark all as read"}</Button></Stack>{error ? <Alert severity="error">{error}</Alert> : null}{items === null ? <LoadingState label="Loading notifications…" /> : items.length ? <Stack spacing={1}>{items.map((item) => <Card key={item.id} variant="outlined" sx={{ borderColor: item.readAt ? undefined : "primary.main" }}><CardContent><Stack spacing={1}><Typography>{item.message}</Typography><Typography variant="body2" color="text.secondary">{new Date(item.createdAt).toLocaleString()} {!item.readAt ? "· unread" : null}</Typography><Stack direction="row" spacing={1}>{item.postId ? <Button size="small" component="a" href={`/posts/${encodeURIComponent(item.postId)}`}>Open post</Button> : null}{!item.readAt ? <Button size="small" disabled={busy === item.id} onClick={() => void mark(item.id)}>Mark read</Button> : null}</Stack></Stack></CardContent></Card>)}</Stack> : <Card variant="outlined"><CardContent><Typography>No notifications yet.</Typography></CardContent></Card>}</Stack></Page>;
}

function ProfileSettingsPage() {
    const [user, setUser] = useState<User | null>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
    const [avatarMode, setAvatarMode] = useState("initials"); const [avatarValue, setAvatarValue] = useState(""); const [banner, setBanner] = useState(""); const [accent, setAccent] = useState("#0645ad");
    useEffect(() => { void api<{ data: User }>("/v1/me").then((r) => { setUser(r.data); setAvatarMode(r.data.avatarMode || "initials"); setAvatarValue(r.data.avatarValue || ""); setBanner(r.data.profileBannerUrl || ""); setAccent(r.data.accentColor || "#0645ad"); }).catch((e) => setError((e as Error & { status?: number }).status === 401 ? "Please sign in." : e instanceof Error ? e.message : "Unable to load profile settings.")); }, []);
    async function save(e: React.FormEvent) { e.preventDefault(); if (!user) return; setSaving(true); setError(""); try { await api(`/v1/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ avatarMode, avatarValue: avatarValue || null, profileBannerUrl: banner || null, accentColor: accent }) }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save profile settings."); } finally { setSaving(false); } }
    if (!user) return <Page maxWidth="sm">{error ? <Alert severity="error">{error}</Alert> : <LoadingState label="Loading profile settings…" />}</Page>;
    return <Page maxWidth="sm"><Stack spacing={2}><Typography variant="h4" component="h1">Profile settings</Typography><Card variant="outlined"><CardContent><Stack component="form" spacing={2} onSubmit={save}><FormControl fullWidth><InputLabel id="avatar-mode">Avatar mode</InputLabel><Select labelId="avatar-mode" label="Avatar mode" value={avatarMode} onChange={(e) => setAvatarMode(e.target.value)}><MenuItem value="initials">Text / initials</MenuItem><MenuItem value="default">Default</MenuItem><MenuItem value="identicon">Identicon</MenuItem><MenuItem value="gravatar">Gravatar</MenuItem><MenuItem value="custom">Custom</MenuItem></Select></FormControl><TextField label="Avatar value" value={avatarValue} onChange={(e) => setAvatarValue(e.target.value)} /><TextField label="Profile banner URL" type="url" value={banner} onChange={(e) => setBanner(e.target.value)} inputProps={{ maxLength: 2048 }} /><Stack direction="row" alignItems="center" spacing={2}><TextField label="Accent color" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} sx={{ width: 140 }} /><Typography color="text.secondary">{accent}</Typography></Stack>{error ? <Alert severity="error">{error}</Alert> : null}<Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button></Stack></CardContent></Card></Stack></Page>;
}

function EntityListPage({ taxonomy }: { taxonomy: "users" | "tags" | "categories" }) {
    const [items, setItems] = useState<Array<Record<string, unknown>> | null>(null); const [error, setError] = useState("");
    useEffect(() => { void api<{ data: Array<Record<string, unknown>> }>(`/v1/${taxonomy}?limit=100`).then((r) => setItems(r.data)).catch((e) => setError(e instanceof Error ? e.message : `Unable to load ${taxonomy}.`)); }, [taxonomy]);
    const label = taxonomy[0]!.toUpperCase() + taxonomy.slice(1);
    return <Page><Stack spacing={2}><Typography variant="h4" component="h1">{label}</Typography>{error ? <Alert severity="error">{error}</Alert> : null}{items === null ? <LoadingState label={`Loading ${taxonomy}…`} /> : <Stack spacing={1}>{items.map((item) => { const id = String(item.id); const name = String(item.name ?? id); const count = Number((item._count as { posts?: number } | undefined)?.posts ?? 0); return <Card key={id} variant="outlined"><CardActionArea component="a" href={`/${taxonomy}/${encodeURIComponent(id)}`}><CardContent><Typography variant="h6">{name}</Typography><Typography variant="body2" color="text.secondary">{count} post{count === 1 ? "" : "s"}</Typography></CardContent></CardActionArea></Card>; })}</Stack>}</Stack></Page>;
}

function EntityPostsPage({ taxonomy, id }: { taxonomy: "users" | "tags" | "categories"; id: string }) {
    const [posts, setPosts] = useState<Post[] | null>(null); const [error, setError] = useState("");
    useEffect(() => { void api<{ data?: Post[] }>(`/v1/${taxonomy}/${encodeURIComponent(id)}/posts?limit=100`).then((r) => setPosts(r.data ?? [])).catch((e) => setError(e instanceof Error ? e.message : "Unable to load posts.")); }, [taxonomy, id]);
    return <Page><Stack spacing={2}><Typography variant="h4" component="h1">{taxonomy === "users" ? "User Posts" : taxonomy === "tags" ? "Tagged Posts" : "Category Posts"}</Typography>{error ? <Alert severity="error">{error}</Alert> : posts === null ? <LoadingState label="Loading posts…" /> : <PageCards posts={posts} />}</Stack></Page>;
}

function EntityPage({ taxonomy, id }: { taxonomy: "users" | "tags" | "categories"; id: string }) {
    const [entity, setEntity] = useState<Record<string, unknown> | null>(null); const [posts, setPosts] = useState<Post[]>([]); const [error, setError] = useState("");
    useEffect(() => { void Promise.all([api<{ data: Record<string, unknown> }>(`/v1/${taxonomy}/${encodeURIComponent(id)}`), api<{ data?: Post[] }>(`/v1/${taxonomy}/${encodeURIComponent(id)}/posts?limit=100`)]).then(([a, p]) => { setEntity(a.data); setPosts(p.data ?? []); }).catch((e) => setError(e instanceof Error ? e.message : `${taxonomy.slice(0, -1)} not found.`)); }, [taxonomy, id]);
    if (error) return <Page><Alert severity="error">{error}</Alert></Page>; if (!entity) return <Page><LoadingState /> </Page>;
    if (taxonomy === "users") { const u = entity as User & { _count?: { posts?: number }; profileBannerUrl?: string; accentColor?: string }; return <Page><Stack spacing={2}><Card variant="outlined" sx={{ overflow: "hidden" }}>{u.profileBannerUrl ? <Box component="img" src={u.profileBannerUrl} sx={{ width: "100%", maxHeight: 280, objectFit: "cover" }} /> : null}<CardContent><Stack direction="row" spacing={2} alignItems="center"><Avatar src={u.avatarUrl ?? undefined} sx={{ width: 72, height: 72 }}>{(u.name || "U").charAt(0).toUpperCase()}</Avatar><Stack><Typography variant="h4" component="h1">{u.name}</Typography><Typography color="text.secondary">{u._count?.posts ?? posts.length} post{(u._count?.posts ?? posts.length) === 1 ? "" : "s"} · Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ""}</Typography></Stack></Stack>{u.bio ? <Typography sx={{ mt: 2 }}>{u.bio}</Typography> : null}<Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>{u.websiteUrl ? <Chip component="a" clickable label="Website" href={u.websiteUrl} /> : null}{u.githubUrl ? <Chip component="a" clickable label="GitHub" href={u.githubUrl} /> : null}{(u.profileLinks ?? []).map((l) => <Chip key={l.id} component="a" clickable label={l.label} href={l.url} />)}</Stack></CardContent></Card><PageCards posts={posts.slice(0, 6)} /></Stack></Page>; }
    const name = String(entity.name ?? id); return <Page><Stack spacing={2}><Card variant="outlined"><CardContent><Typography variant="h4" component="h1">{name}</Typography><Typography color="text.secondary">{posts.length} post{posts.length === 1 ? "" : "s"}</Typography></CardContent></Card><PageCards posts={posts} /></Stack></Page>;
}

function SearchPage() {
    const [query, setQuery] = useState(new URLSearchParams(location.search).get("q") ?? ""); const [results, setResults] = useState<Record<string, unknown[]> | null>(null); const [error, setError] = useState("");
    const submit = async (e: React.FormEvent) => { e.preventDefault(); const q = query.trim(); if (!q) return; setError(""); try { const r = await api<{ data: Record<string, unknown[]> }>(`/v1/search?q=${encodeURIComponent(q)}&type=all&limit=25`); setResults(r.data); history.replaceState(null, "", `/search/?q=${encodeURIComponent(q)}`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Search failed."); } };
    const href = (type: string, item: Record<string, unknown>) => type === "posts" ? `/posts/${encodeURIComponent(String(item.id))}` : type === "users" ? `/users/${encodeURIComponent(String(item.id))}` : type === "tags" ? `/tags/${encodeURIComponent(String(item.id))}` : `/categories/${encodeURIComponent(String(item.id))}`;
    return <Page><Stack spacing={2}><Typography variant="h4" component="h1">Search</Typography><Card variant="outlined"><CardContent><Stack component="form" direction={{ xs: "column", sm: "row" }} spacing={1} onSubmit={submit}><TextField fullWidth label="Query" value={query} onChange={(e) => setQuery(e.target.value)} required /><Button type="submit" variant="contained">Search</Button></Stack></CardContent></Card>{error ? <Alert severity="error">{error}</Alert> : null}{results ? Object.entries(results).map(([type, items]) => <Card key={type} variant="outlined"><CardContent><Typography variant="h6" sx={{ textTransform: "capitalize" }}>{type}</Typography>{items.length ? <Stack divider={<Divider />}>{items.map((item) => <Button key={String((item as Record<string, unknown>).id)} component="a" href={href(type, item as Record<string, unknown>)} sx={{ justifyContent: "flex-start" }}>{String((item as Record<string, unknown>).name ?? (item as Record<string, unknown>).title ?? (item as Record<string, unknown>).id)}</Button>)}</Stack> : <Typography color="text.secondary">No results.</Typography>}</CardContent></Card>) : null}</Stack></Page>;
}

function StaticInfoPage({ kind }: { kind: "about" | "faq" | "github" | "privacy" | "terms" }) {
    const content = {
        about: <><Typography variant="h4" component="h1">About imshare</Typography><Card variant="outlined"><CardContent><Typography>imshare is a self-hosted image archive and sharing server.</Typography><Typography sx={{ mt: 1 }}>This instance is powered by the imshare API.</Typography></CardContent></Card></>,
        github: <><Typography variant="h4" component="h1">imshare on GitHub</Typography><Card variant="outlined"><CardContent><Typography>imshare is developed as a self-hosted image archive and sharing server.</Typography><Typography sx={{ mt: 1 }}>The project repository is private at the moment. This application uses AI-assisted development in parts of its implementation and documentation.</Typography></CardContent></Card></>,
        privacy: <><Typography variant="h4" component="h1">Privacy</Typography><Card variant="outlined"><CardContent><Typography>Replace this page with the privacy policy for this imshare instance.</Typography></CardContent></Card></>,
        terms: <><Typography variant="h4" component="h1">Terms of Service</Typography><Card variant="outlined"><CardContent><Typography>Replace this page with the terms of service for this imshare instance.</Typography></CardContent></Card></>,
        faq: <><Typography variant="h4" component="h1">FAQs</Typography>{[["About imshare", "What is imshare?", "imshare is a self-hosted image archive and sharing application. It lets you upload, organize, browse, and share images while keeping the server and its data under the instance operator's control."],["Images and privacy", "Who can access my images?", "Access depends on the visibility of the post and how the server is configured. Public posts can be viewed by anyone who can reach the instance, while private or otherwise restricted posts follow their configured access rules."],["Comments and moderation", "Can I delete my comments?", "Yes. Comment authors can remove their own comments, and image owners can remove comments from their posts."],["Accounts and access", "Who operates an imshare instance?", "Each instance is operated independently. The instance administrator controls its configuration, storage, moderation policies, and available features."]].map(([heading, q, a]) => <Card key={heading} variant="outlined"><CardContent><Typography variant="h6">{heading}</Typography><Typography variant="subtitle1" sx={{ mt: 1 }}>{q}</Typography><Typography color="text.secondary">{a}</Typography></CardContent></Card>)}</>,
    } as const;
    return <Page><Stack spacing={2}>{content[kind]}</Stack></Page>;
}

function AdminPage() {
    const [data, setData] = useState<{ overview?: Record<string, number>; token?: { token: string; expiresAt: string }; users?: Array<Record<string, unknown>>; reports?: Array<Record<string, unknown>>; logs?: Array<Record<string, unknown>> } | null>(null); const [error, setError] = useState("");
    const load = async () => { try { const [o, t, u, r, l] = await Promise.all([api<{ data: Record<string, number> }>("/v1/admin/overview"), api<{ data: { token: string; expiresAt: string } }>("/v1/admin/registration-token"), api<{ data: Array<Record<string, unknown>> }>("/v1/admin/users?limit=50"), api<{ data: Array<Record<string, unknown>> }>("/v1/admin/reports"), api<{ data: Array<Record<string, unknown>> }>("/v1/admin/logs")]); setData({ overview: o.data, token: t.data, users: u.data, reports: r.data, logs: l.data }); } catch (cause) { const status = (cause as Error & { status?: number }).status; if (status === 401) location.href = "/account/login/"; else setError(cause instanceof Error ? cause.message : "Unable to load admin page."); } };
    useEffect(() => { void load(); }, []);
    async function action(path: string, options?: RequestInit) { try { await api(path, options); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); } }
    if (!data) return <Page><Stack spacing={2}>{error ? <Alert severity="error">{error}</Alert> : <LoadingState label="Loading admin dashboard…" />}</Stack></Page>;
    return <Page><Stack spacing={2}><Typography variant="h4" component="h1">Admin</Typography>{error ? <Alert severity="error">{error}</Alert> : null}<Card variant="outlined"><CardContent><Typography variant="h6">Overview</Typography><Typography>{data.overview?.users ?? 0} users · {data.overview?.posts ?? 0} posts · {data.overview?.openReports ?? 0} open reports · {data.overview?.bannedUsers ?? 0} banned</Typography></CardContent></Card><Card variant="outlined"><CardContent><Typography variant="h6">Registration token</Typography><Typography component="code" sx={{ wordBreak: "break-all" }}>{data.token?.token}</Typography><Typography variant="body2" color="text.secondary">Expires: {data.token?.expiresAt}</Typography></CardContent></Card><Card variant="outlined"><CardContent><Typography variant="h6">Users</Typography><Stack divider={<Divider />}>{(data.users ?? []).map((u) => <Stack key={String(u.id)} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} py={1}><Typography sx={{ flexGrow: 1 }}>{String(u.name)} · {String(u.email)} · {String(u.role)} · {u.isBanned ? "banned" : "active"}</Typography><Button size="small" onClick={() => void action(`/v1/admin/users/${u.id}/${u.isBanned ? "unban" : "kick"}`, { method: "POST", body: "{}" })}>{u.isBanned ? "Unban" : "Kick"}</Button><Button size="small" color="error" onClick={() => { const reason = window.prompt("Ban reason:"); if (reason) void action(`/v1/admin/users/${u.id}/ban`, { method: "POST", body: JSON.stringify({ reason }) }); }}>Ban</Button></Stack>)}</Stack></CardContent></Card><Card variant="outlined"><CardContent><Typography variant="h6">Open reports</Typography>{(data.reports ?? []).length ? (data.reports ?? []).map((r) => <Stack key={String(r.id)} direction="row" spacing={1} py={1}><Typography sx={{ flexGrow: 1 }}>{String(r.reason)}</Typography><Button size="small" onClick={() => void action(`/v1/admin/reports/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: "resolved" }) })}>Resolve</Button><Button size="small" onClick={() => void action(`/v1/admin/reports/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: "dismissed" }) })}>Dismiss</Button></Stack>) : <Typography color="text.secondary">No open reports.</Typography>}</CardContent></Card><Card variant="outlined"><CardContent><Typography variant="h6">Moderation log</Typography>{(data.logs ?? []).map((l, i) => <Typography key={i} variant="body2" sx={{ py: 0.5 }}>{String(l.action)} · {String((l.actor as Record<string, unknown> | undefined)?.name)} → {String((l.targetUser as Record<string, unknown> | undefined)?.name)} · {String(l.reason)}</Typography>)}</CardContent></Card></Stack></Page>;
}

function LegacyApp() {
    let current: ReturnType<typeof route>;
    try { current = route(); } catch (cause) { return <Page><Alert severity="error">{cause instanceof Error ? cause.message : "Unsupported page."}</Alert></Page>; }
    switch (current.kind) {
        case "login": return <AuthPage register={false} />;
        case "register": return <AuthPage register />;
        case "notifications": return <NotificationsPage />;
        case "profile": return <ProfileSettingsPage />;
        case "users": return <EntityListPage taxonomy="users" />;
        case "user": return <EntityPage taxonomy="users" id={current.id!} />;
        case "user-posts": return <EntityPostsPage taxonomy="users" id={current.id!} />;
        case "tags": return <EntityListPage taxonomy="tags" />;
        case "tag": return <EntityPage taxonomy="tags" id={current.id!} />;
        case "tag-posts": return <EntityPostsPage taxonomy="tags" id={current.id!} />;
        case "categories": return <EntityListPage taxonomy="categories" />;
        case "category": return <EntityPage taxonomy="categories" id={current.id!} />;
        case "category-posts": return <EntityPostsPage taxonomy="categories" id={current.id!} />;
        case "search": return <SearchPage />;
        case "admin": return <AdminPage />;
        case "about": case "faq": case "github": case "privacy": case "terms": return <StaticInfoPage kind={current.kind} />;
    }
}

const root = document.querySelector("#legacy-page");
if (root) createRoot(root).render(<App><LegacyApp /></App>);
