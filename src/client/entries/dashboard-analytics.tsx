import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
import { TimeSeriesGraph, type TimeSeriesPoint } from "../components/TimeSeriesGraph";

interface Analytics {
    periodDays: number;
    totals: {
        posts: number;
        views: number;
        comments: number;
        reactions: number;
        uploads: number;
        followers: number;
    };
    recent: {
        views: number;
        comments: number;
        reactions: number;
        uploads: number;
        uniqueViewers: number;
    };
    viewsByDay: Array<{ day: string; views: number }>;
    activityByDay: TimeSeriesPoint[];
    topPosts: Array<{ postId: string; title: string; views: number }>;
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="body2" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="h4">{value.toLocaleString()}</Typography>
            </CardContent>
        </Card>
    );
}

function CreatorAnalytics() {
    const [data, setData] = useState<Analytics | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        void api<{ data: Analytics }>("/v1/me/analytics?days=30")
            .then((r) => setData(r.data))
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics."));
    }, []);
    return (
        <Page>
            <Stack spacing={3}>
                <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1">
                        Creator Analytics
                    </Typography>
                    <Typography color="text.secondary">
                        See how your posts are performing.
                    </Typography>
                </Stack>
                {error ? <Alert severity="error">{error}</Alert> : null}
                {data ? (
                    <>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, 1fr)",
                                    lg: "repeat(3, 1fr)",
                                },
                                gap: 2,
                            }}
                        >
                            <Stat label="Posts" value={data.totals.posts} />
                            <Stat label="All-time views" value={data.totals.views} />
                            <Stat label="Followers" value={data.totals.followers} />
                            <Stat label="Views (30 days)" value={data.recent.views} />
                            <Stat
                                label="Unique signed-in viewers"
                                value={data.recent.uniqueViewers}
                            />
                            <Stat label="Comments (30 days)" value={data.recent.comments} />
                            <Stat label="Reactions (30 days)" value={data.recent.reactions} />
                            <Stat label="Uploads (30 days)" value={data.recent.uploads} />
                        </Box>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={2}>
                                    <Typography variant="h6">
                                        Activity — last {data.periodDays} days
                                    </Typography>
                                    <TimeSeriesGraph
                                        data={data.activityByDay}
                                        series={[
                                            { key: "views", label: "Views" },
                                            { key: "comments", label: "Comments" },
                                            { key: "reactions", label: "Reactions" },
                                            { key: "uploads", label: "Uploads" },
                                        ]}
                                    />
                                </Stack>
                            </CardContent>
                        </Card>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={1.5}>
                                    <Typography variant="h6">Most viewed posts</Typography>
                                    {data.topPosts.length ? (
                                        data.topPosts.map((post) => (
                                            <Stack key={post.postId} direction="row" spacing={2}>
                                                <Typography
                                                    component="a"
                                                    href={
                                                        "/posts/" +
                                                        encodeURIComponent(post.postId) +
                                                        "/"
                                                    }
                                                    sx={{ flex: 1, color: "inherit" }}
                                                >
                                                    {post.title}
                                                </Typography>
                                                <Typography color="text.secondary">
                                                    {post.views.toLocaleString()} views
                                                </Typography>
                                            </Stack>
                                        ))
                                    ) : (
                                        <Typography color="text.secondary">
                                            No views recorded in this period.
                                        </Typography>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                        <Alert severity="info">
                            Analytics are limited to your own posts. Anonymous views are included in
                            view totals, while unique-viewer counts only include signed-in viewers.
                        </Alert>
                    </>
                ) : !error ? (
                    <Typography color="text.secondary">Loading analytics…</Typography>
                ) : null}
            </Stack>
        </Page>
    );
}
const root = document.querySelector("#dashboard-analytics-page");
if (root)
    createRoot(root).render(
        <App>
            <CreatorAnalytics />
        </App>,
    );
