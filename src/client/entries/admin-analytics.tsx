import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";

interface Analytics {
    periodDays: number;
    totals: { users: number; posts: number; comments: number; reactions: number; uploads: number; views: number; uniqueViewers: number };
    viewsByDay: Array<{ day: string; views: number }>;
    topPosts: Array<{ postId: string; title: string; views: number }>;
}

function Stat({ label, value }: { label: string; value: number }) {
    return <Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4">{value.toLocaleString()}</Typography></CardContent></Card>;
}

function AnalyticsPage() {
    const [data, setData] = useState<Analytics | null>(null);
    const [error, setError] = useState("");
    useEffect(() => { void api<{ data: Analytics }>("/v1/admin/analytics?days=30").then((result) => setData(result.data)).catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load analytics.")); }, []);
    const maxViews = useMemo(() => Math.max(1, ...(data?.viewsByDay.map((item) => item.views) ?? [0])), [data]);

    return <AdminLayout title="Analytics" description="First-party instance analytics from imshare's own database." activeHref="/admin/analytics/">
        {error ? <Alert severity="error">{error}</Alert> : null}
        {data ? <Stack spacing={3}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
                <Stat label="Post views" value={data.totals.views} />
                <Stat label="Unique signed-in viewers" value={data.totals.uniqueViewers} />
                <Stat label="New users" value={data.totals.users} />
                <Stat label="New posts" value={data.totals.posts} />
                <Stat label="Comments" value={data.totals.comments} />
                <Stat label="Reactions" value={data.totals.reactions} />
                <Stat label="Uploads" value={data.totals.uploads} />
            </Box>
            <Card variant="outlined"><CardContent><Stack spacing={2}>
                <Typography variant="h6">Views — last {data.periodDays} days</Typography>
                <Stack direction="row" alignItems="end" spacing={0.5} sx={{ height: 220, overflowX: "auto", pb: 1 }}>
                    {data.viewsByDay.map((item) => <Stack key={item.day} spacing={0.5} alignItems="center" justifyContent="end" sx={{ minWidth: 22, height: "100%" }}>
                        <Typography variant="caption">{item.views || ""}</Typography>
                        <Box sx={{ width: 16, minHeight: item.views ? 3 : 1, height: Math.max(1, (item.views / maxViews) * 170) + "px", borderRadius: "4px 4px 0 0", bgcolor: "primary.main" }} />
                        <Typography variant="caption" sx={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{item.day.slice(5)}</Typography>
                    </Stack>)}
                </Stack>
            </Stack></CardContent></Card>
            <Card variant="outlined"><CardContent><Stack spacing={1.5}>
                <Typography variant="h6">Most viewed posts</Typography>
                {data.topPosts.length ? data.topPosts.map((post, index) => <Stack key={post.postId} direction="row" spacing={1.5} alignItems="center"><Chip size="small" label={index + 1} /><Typography component="a" href={"/posts/" + encodeURIComponent(post.postId) + "/"} sx={{ flex: 1, color: "inherit" }}>{post.title}</Typography><Typography color="text.secondary">{post.views.toLocaleString()} views</Typography></Stack>) : <Typography color="text.secondary">No post views recorded in this period.</Typography>}
            </Stack></CardContent></Card>
            <Alert severity="info">Anonymous visitors are not counted as unique viewers. View analytics use post-view records already stored by imshare and do not add a separate third-party tracking system.</Alert>
        </Stack> : !error ? <Typography color="text.secondary">Loading analytics…</Typography> : null}
    </AdminLayout>;
}

const root = document.querySelector("#admin-analytics-page");
if (root) createRoot(root).render(<App><AnalyticsPage /></App>);
