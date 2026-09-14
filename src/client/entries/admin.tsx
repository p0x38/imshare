import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControl,
    FormHelperText,
    InputLabel,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
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
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h4" component="p">{value.toLocaleString()}</Typography>
                </Stack>
            </CardContent>
        </Card>
    );
    return href ? <Box component="a" href={href} sx={{ textDecoration: "none", display: "block", height: "100%" }}>{content}</Box> : content;
}

function AdminPage() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [analytics, setAnalytics] = useState<Analytics>({
        googleAnalyticsMeasurementId: "",
        googleTagManagerContainerId: "",
    });
    const [token, setToken] = useState<RegistrationToken | null>(null);
    const [ga, setGa] = useState("");
    const [gtm, setGtm] = useState("");
    const [role, setRole] = useState("moderator");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [savingAnalytics, setSavingAnalytics] = useState(false);
    const [loadingToken, setLoadingToken] = useState(false);
    const [rotatingToken, setRotatingToken] = useState(false);

    async function load() {
        setError("");
        try {
            const [overviewResult, analyticsResult, tokenResult] = await Promise.all([
                api<{ data: Overview }>("/v1/admin/overview"),
                api<{ data: Analytics }>("/v1/admin/analytics"),
                api<{ data: RegistrationToken }>("/v1/admin/registration-token"),
            ]);
            setOverview(overviewResult.data);
            setAnalytics(analyticsResult.data);
            setGa(analyticsResult.data.googleAnalyticsMeasurementId);
            setGtm(analyticsResult.data.googleTagManagerContainerId);
            setToken(tokenResult.data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load administrator settings.");
        }
    }

    useEffect(() => { void load(); }, []);

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
            setNotice("Analytics settings saved.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save analytics settings.");
        } finally {
            setSavingAnalytics(false);
        }
    }

    async function loadToken() {
        setLoadingToken(true);
        setError("");
        try {
            const result = await api<{ data: RegistrationToken }>("/v1/admin/registration-token");
            setToken(result.data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load registration token.");
        } finally {
            setLoadingToken(false);
        }
    }

    async function rotateToken() {
        setRotatingToken(true);
        setError("");
        try {
            const result = await api<{ data: RegistrationToken }>("/v1/admin/registration-token", { method: "POST" });
            setToken(result.data);
            setNotice("Registration token rotated.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to rotate registration token.");
        } finally {
            setRotatingToken(false);
        }
    }

    const expiresLabel = token?.expiresAt
        ? new Date(token.expiresAt).toLocaleString()
        : "Rotation is controlled by the server's registration-token policy.";

    return (
        <Page maxWidth="xl">
            <Stack spacing={3}>
                <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1">Administration</Typography>
                    <Typography color="text.secondary">Monitor the instance and manage administrator-only configuration.</Typography>
                </Stack>

                {error ? <Alert severity="error">{error}</Alert> : null}
                {notice ? <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert> : null}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2 }}>
                    <StatCard label="Users" value={overview?.users ?? 0} href="/users/" />
                    <StatCard label="Posts" value={overview?.posts ?? 0} href="/posts/" />
                    <StatCard label="Open reports" value={overview?.openReports ?? 0} />
                    <StatCard label="Banned users" value={overview?.bannedUsers ?? 0} />
                    <StatCard label="Administrators" value={overview?.admins ?? 0} />
                    <StatCard label="Moderators" value={overview?.moderators ?? 0} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.5fr) minmax(320px, 1fr)" }, gap: 2, alignItems: "start" }}>
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={2} component="form" onSubmit={saveAnalytics}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" component="h2">Analytics</Typography>
                                        <Typography variant="body2" color="text.secondary">Configure Google Analytics 4 and Google Tag Manager without changing application code.</Typography>
                                    </Stack>
                                    <TextField
                                        label="Google Analytics measurement ID"
                                        value={ga}
                                        onChange={(event) => setGa(event.target.value)}
                                        placeholder="G-XXXXXXXXXX"
                                        helperText="Leave empty to disable Google Analytics."
                                        fullWidth
                                    />
                                    <TextField
                                        label="Google Tag Manager container ID"
                                        value={gtm}
                                        onChange={(event) => setGtm(event.target.value)}
                                        placeholder="GTM-XXXXXXX"
                                        helperText="Leave empty to disable Google Tag Manager."
                                        fullWidth
                                    />
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                                        <Stack direction="row" spacing={1}>
                                            {analytics.googleAnalyticsMeasurementId ? <Chip label="GA enabled" size="small" color="success" variant="outlined" /> : <Chip label="GA disabled" size="small" variant="outlined" />}
                                            {analytics.googleTagManagerContainerId ? <Chip label="GTM enabled" size="small" color="success" variant="outlined" /> : <Chip label="GTM disabled" size="small" variant="outlined" />}
                                        </Stack>
                                        <Button type="submit" variant="contained" disabled={savingAnalytics}>{savingAnalytics ? "Saving…" : "Save analytics"}</Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={1.5}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" component="h2">Administration shortcuts</Typography>
                                        <Typography variant="body2" color="text.secondary">Frequently used management areas.</Typography>
                                    </Stack>
                                    <List disablePadding>
                                        <ListItem disablePadding><ListItemButton component="a" href="/dashboard/posts/"><ListItemText primary="Manage posts" secondary="Review and edit your site's posts." /></ListItemButton></ListItem>
                                        <Divider component="li" />
                                        <ListItem disablePadding><ListItemButton component="a" href="/dashboard/tags/"><ListItemText primary="Manage tags" secondary="Create and maintain post taxonomy." /></ListItemButton></ListItem>
                                        <Divider component="li" />
                                        <ListItem disablePadding><ListItemButton component="a" href="/dashboard/categories/"><ListItemText primary="Manage categories" secondary="Organize posts into categories." /></ListItemButton></ListItem>
                                        <Divider component="li" />
                                        <ListItem disablePadding><ListItemButton component="a" href="/docs/"><ListItemText primary="Open API documentation" secondary="Inspect the instance's OpenAPI endpoints." /></ListItemButton></ListItem>
                                    </List>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" component="h2">Registration access</Typography>
                                        <Typography variant="body2" color="text.secondary">The current token is required when registration is protected by the instance registration policy.</Typography>
                                    </Stack>
                                    <TextField
                                        label="Current registration token"
                                        value={token?.token ?? ""}
                                        slotProps={{ input: { readOnly: true } }}
                                        fullWidth
                                    />
                                    <Typography variant="body2" color="text.secondary">{expiresLabel}</Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Button variant="outlined" onClick={() => void loadToken()} disabled={loadingToken || rotatingToken}>
                                            {loadingToken ? "Loading…" : "Refresh token"}
                                        </Button>
                                        <Button variant="contained" color="warning" onClick={() => void rotateToken()} disabled={rotatingToken}>
                                            {rotatingToken ? "Rotating…" : "Rotate token"}
                                        </Button>
                                    </Stack>
                                    <FormControl size="small" fullWidth>
                                        <InputLabel id="admin-role">Example moderation scope</InputLabel>
                                        <Select labelId="admin-role" label="Example moderation scope" value={role} onChange={(event) => setRole(event.target.value)}>
                                            <MenuItem value="moderator">Moderator</MenuItem>
                                            <MenuItem value="admin">Administrator</MenuItem>
                                        </Select>
                                        <FormHelperText>Current role scope: {role}. This control is informational.</FormHelperText>
                                    </FormControl>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                </Box>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#admin-page");
if (root) createRoot(root).render(<App><AdminPage /></App>);
