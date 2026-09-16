import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { api } from "../lib/api";
interface Overview {
    users: number;
    posts: number;
    openReports: number;
    bannedUsers: number;
    admins: number;
    moderators: number;
}
interface Analytics {
    googleAnalyticsMeasurementId: string;
    googleTagManagerContainerId: string;
}
interface RegistrationToken {
    token: string;
    expiresAt?: string | null;
}
function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
    const content = (
        <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                        {label}
                    </Typography>
                    <Typography variant="h4" component="p">
                        {value.toLocaleString()}
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
    return href ? (
        <Box
            component="a"
            href={href}
            sx={{ textDecoration: "none", display: "block", height: "100%" }}
        >
            {content}
        </Box>
    ) : (
        content
    );
}
function AdminPage() {
    const { t } = useTranslation();
    const [overview, setOverview] = useState<Overview | null>(null);
    const [analytics, setAnalytics] = useState<Analytics>({
        googleAnalyticsMeasurementId: "",
        googleTagManagerContainerId: "",
    });
    const [token, setToken] = useState<RegistrationToken | null>(null);
    const [ga, setGa] = useState("");
    const [gtm, setGtm] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [savingAnalytics, setSavingAnalytics] = useState(false);
    const [loadingToken, setLoadingToken] = useState(false);
    async function load() {
        setError("");
        try {
            const [a, b, c] = await Promise.all([
                api<{ data: Overview }>("/v1/admin/overview"),
                api<{ data: Analytics }>("/v1/admin/analytics"),
                api<{ data: RegistrationToken }>("/v1/admin/registration-token"),
            ]);
            setOverview(a.data);
            setAnalytics(b.data);
            setGa(b.data.googleAnalyticsMeasurementId);
            setGtm(b.data.googleTagManagerContainerId);
            setToken(c.data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("admin.loadError"));
        }
    }
    useEffect(() => {
        void load();
    }, []);
    async function saveAnalytics(event: React.FormEvent) {
        event.preventDefault();
        setSavingAnalytics(true);
        setError("");
        setNotice("");
        try {
            const result = await api<{ data: Analytics }>("/v1/admin/analytics", {
                method: "PATCH",
                body: JSON.stringify({
                    googleAnalyticsMeasurementId: ga.trim(),
                    googleTagManagerContainerId: gtm.trim(),
                }),
            });
            setAnalytics(result.data);
            setGa(result.data.googleAnalyticsMeasurementId);
            setGtm(result.data.googleTagManagerContainerId);
            setNotice(t("admin.analyticsSaved"));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("admin.saveError"));
        } finally {
            setSavingAnalytics(false);
        }
    }
    async function refreshToken() {
        setLoadingToken(true);
        setError("");
        try {
            const result = await api<{ data: RegistrationToken }>("/v1/admin/registration-token", {
                method: "POST",
            });
            setToken(result.data);
            setNotice(t("admin.tokenRefreshed"));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("admin.refreshError"));
        } finally {
            setLoadingToken(false);
        }
    }
    const expiresLabel = token?.expiresAt
        ? new Date(token.expiresAt).toLocaleString()
        : t("admin.tokenPolicy");
    return (
        <Page maxWidth="xl">
            <Stack spacing={3}>
                <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1">
                        {t("admin.administration")}
                    </Typography>
                    <Typography color="text.secondary">{t("admin.description")}</Typography>
                </Stack>
                {error ? <Alert severity="error">{error}</Alert> : null}
                {notice ? (
                    <Alert severity="success" onClose={() => setNotice("")}>
                        {notice}
                    </Alert>
                ) : null}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2,1fr)",
                            lg: "repeat(3,1fr)",
                        },
                        gap: 2,
                    }}
                >
                    <StatCard
                        label={t("admin.users")}
                        value={overview?.users ?? 0}
                        href="/users/"
                    />
                    <StatCard
                        label={t("admin.posts")}
                        value={overview?.posts ?? 0}
                        href="/posts/"
                    />
                    <StatCard label={t("admin.openReports")} value={overview?.openReports ?? 0} />
                    <StatCard label={t("admin.bannedUsers")} value={overview?.bannedUsers ?? 0} />
                    <StatCard label={t("admin.administrators")} value={overview?.admins ?? 0} />
                    <StatCard label={t("admin.moderators")} value={overview?.moderators ?? 0} />
                </Box>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.5fr) minmax(320px,1fr)" },
                        gap: 2,
                        alignItems: "start",
                    }}
                >
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={2} component="form" onSubmit={saveAnalytics}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" component="h2">
                                            {t("admin.analytics")}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("admin.analyticsDescription")}
                                        </Typography>
                                    </Stack>
                                    <TextField
                                        label={t("admin.gaId")}
                                        value={ga}
                                        onChange={(e) => setGa(e.target.value)}
                                        placeholder="G-XXXXXXXXXX"
                                        helperText={t("admin.gaHelp")}
                                        fullWidth
                                    />
                                    <TextField
                                        label={t("admin.gtmId")}
                                        value={gtm}
                                        onChange={(e) => setGtm(e.target.value)}
                                        placeholder="GTM-XXXXXXX"
                                        helperText={t("admin.gtmHelp")}
                                        fullWidth
                                    />
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        flexWrap="wrap"
                                        gap={1}
                                    >
                                        <Stack direction="row" spacing={1}>
                                            {analytics.googleAnalyticsMeasurementId ? (
                                                <Chip
                                                    label={t("admin.gaEnabled")}
                                                    size="small"
                                                    color="success"
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Chip
                                                    label={t("admin.gaDisabled")}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            {analytics.googleTagManagerContainerId ? (
                                                <Chip
                                                    label={t("admin.gtmEnabled")}
                                                    size="small"
                                                    color="success"
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Chip
                                                    label={t("admin.gtmDisabled")}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                        </Stack>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={savingAnalytics}
                                        >
                                            {savingAnalytics
                                                ? t("admin.saving")
                                                : t("admin.saveAnalytics")}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={1.5}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" component="h2">
                                            {t("admin.shortcuts")}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("admin.shortcutsDescription")}
                                        </Typography>
                                    </Stack>
                                    <List disablePadding>
                                        <ListItem disablePadding>
                                            <ListItemButton component="a" href="/dashboard/posts/">
                                                <ListItemText
                                                    primary={t("dashboardPage.managePosts")}
                                                    secondary={t("admin.reviewPosts")}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem disablePadding>
                                            <ListItemButton component="a" href="/dashboard/tags/">
                                                <ListItemText
                                                    primary={t("dashboardPage.manageTags")}
                                                    secondary={t("admin.taxonomyHelp")}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem disablePadding>
                                            <ListItemButton
                                                component="a"
                                                href="/dashboard/categories/"
                                            >
                                                <ListItemText
                                                    primary={t("dashboardPage.manageCategories")}
                                                    secondary={t("admin.categoryHelp")}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem disablePadding>
                                            <ListItemButton component="a" href="/docs/">
                                                <ListItemText
                                                    primary={t("admin.apiDocs")}
                                                    secondary={t("admin.apiDocsHelp")}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    </List>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack spacing={0.5}>
                                    <Typography variant="h6" component="h2">
                                        {t("admin.registrationAccess")}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t("admin.registrationDescription")}
                                    </Typography>
                                </Stack>
                                <TextField
                                    label={t("admin.currentToken")}
                                    value={token?.token ?? ""}
                                    slotProps={{ input: { readOnly: true } }}
                                    fullWidth
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {t("admin.expires", { value: expiresLabel })}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    onClick={() => void refreshToken()}
                                    disabled={loadingToken}
                                >
                                    {loadingToken ? t("admin.refreshing") : t("admin.refreshToken")}
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Box>
            </Stack>
        </Page>
    );
}
const root = document.querySelector("#admin-page");
if (root)
    createRoot(root).render(
        <App>
            <AdminPage />
        </App>,
    );
