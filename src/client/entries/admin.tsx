import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import Group from "@mui/icons-material/Group";
import Article from "@mui/icons-material/Article";
import ReportProblem from "@mui/icons-material/ReportProblem";
import Settings from "@mui/icons-material/Settings";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";

interface Overview {
    users: number;
    posts: number;
    openReports: number;
    bannedUsers: number;
    admins: number;
    moderators: number;
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
    return (
        <Box component="a" href={href} sx={{ display: "block", height: "100%", textDecoration: "none" }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h4" component="p">{value.toLocaleString()}</Typography>
                </CardContent>
            </Card>
        </Box>
    );
}

function AdminPage() {
    const { t } = useTranslation();
    const [overview, setOverview] = useState<Overview | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        void api<{ data: Overview }>("/v1/admin/overview")
            .then((result) => setOverview(result.data))
            .catch((cause) => setError(cause instanceof Error ? cause.message : t("admin.loadError")));
    }, [t]);

    return (
        <AdminLayout title={t("admin.administration")} description="Instance administration overview." activeHref="/admin/">
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack spacing={3}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 2 }}>
                    <StatCard label={t("admin.users")} value={overview?.users ?? 0} href="/admin/users/" />
                    <StatCard label={t("admin.posts")} value={overview?.posts ?? 0} href="/admin/posts/" />
                    <StatCard label={t("admin.openReports")} value={overview?.openReports ?? 0} href="/admin/reports/" />
                    <StatCard label={t("admin.bannedUsers")} value={overview?.bannedUsers ?? 0} href="/admin/users/" />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                    <Card variant="outlined"><CardContent><Stack spacing={1.5}><Group color="action" /><Typography variant="h6">Users</Typography><Typography variant="body2" color="text.secondary">Manage accounts and roles.</Typography><Button href="/admin/users/" variant="outlined">Manage users</Button></Stack></CardContent></Card>
                    <Card variant="outlined"><CardContent><Stack spacing={1.5}><Article color="action" /><Typography variant="h6">Posts</Typography><Typography variant="body2" color="text.secondary">Review and manage posts.</Typography><Button href="/admin/posts/" variant="outlined">Manage posts</Button></Stack></CardContent></Card>
                    <Card variant="outlined"><CardContent><Stack spacing={1.5}><ReportProblem color="action" /><Typography variant="h6">Reports</Typography><Typography variant="body2" color="text.secondary">Review moderation reports.</Typography><Button href="/admin/reports/" variant="outlined">Review reports</Button></Stack></CardContent></Card>
                </Box>

                <Card variant="outlined"><CardContent><Stack spacing={1.5}><Stack direction="row" spacing={1} alignItems="center"><Settings color="action" /><Typography variant="h6">Instance</Typography></Stack><Typography variant="body2" color="text.secondary">Configure instance-wide settings.</Typography><Button href="/admin/settings/" variant="outlined">Open settings</Button></Stack></CardContent></Card>
            </Stack>
        </AdminLayout>
    );
}

const root = document.querySelector("#admin-page");
if (root) createRoot(root).render(<App><AdminPage /></App>);
