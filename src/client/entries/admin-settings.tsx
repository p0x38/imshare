import {
    Alert,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControlLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";

type RegistrationMode = "disabled" | "open" | "token";
interface Config {
    site: { name: string; description?: string; version: string };
    auth: {
        emailAndPasswordEnabled?: boolean;
        registration?: { enabled?: boolean; public?: boolean };
    };
    analytics?: { googleAnalyticsMeasurementId?: string; googleTagManagerContainerId?: string };
    features?: Record<string, boolean>;
    limits?: { textPostCharacters?: number };
}
interface RegistrationToken {
    token: string;
    expiresAt: number;
}
function AdminSettingsPage() {
    const [config, setConfig] = useState<Config | null>(null);
    const [ga, setGa] = useState("");
    const [gtm, setGtm] = useState("");
    const [registrationToken, setRegistrationToken] = useState<RegistrationToken | null>(null);
    const [recipient, setRecipient] = useState("");
    const [mailLoading, setMailLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    useEffect(() => {
        void (async () => {
            try {
                const [settings, token] = await Promise.all([
                    api<{ data: Config }>("/v1/admin/settings"),
                    api<{ data: RegistrationToken }>("/v1/admin/registration-token"),
                ]);
                setConfig(settings.data);
                setGa(settings.data.analytics?.googleAnalyticsMeasurementId ?? "");
                setGtm(settings.data.analytics?.googleTagManagerContainerId ?? "");
                setRegistrationToken(token.data);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to load settings.");
            }
        })();
    }, []);
    function registrationMode(): RegistrationMode {
        if (!config?.auth.registration?.enabled) return "disabled";
        return config.auth.registration.public ? "open" : "token";
    }
    function setRegistrationMode(mode: RegistrationMode) {
        setConfig((current) =>
            !current
                ? current
                : {
                      ...current,
                      auth: {
                          ...current.auth,
                          registration: {
                              ...current.auth.registration,
                              enabled: mode !== "disabled",
                              public: mode === "open",
                          },
                      },
                  },
        );
    }
    async function save(section: "analytics" | "auth") {
        if (!config) return;
        setError("");
        try {
            const body =
                section === "analytics"
                    ? {
                          analytics: {
                              googleAnalyticsMeasurementId: ga.trim(),
                              googleTagManagerContainerId: gtm.trim(),
                          },
                      }
                    : { auth: config.auth };
            const result = await api<{ data: Config }>("/v1/admin/settings", {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            setConfig(result.data);
            if (section === "analytics") {
                setGa(result.data.analytics?.googleAnalyticsMeasurementId ?? "");
                setGtm(result.data.analytics?.googleTagManagerContainerId ?? "");
            }
            setNotice(
                section === "analytics"
                    ? "Analytics settings saved."
                    : "Authentication and registration settings saved.",
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save settings.");
        }
    }
    async function sendTestEmail() {
        setMailLoading(true);
        setError("");
        setNotice("");
        try {
            await api<{ data: { sent: boolean } }>("/v1/admin/mail/test", {
                method: "POST",
                body: JSON.stringify({ recipient: recipient.trim() }),
            });
            setNotice(`Test email sent to ${recipient.trim()}.`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to send test email.");
        } finally {
            setMailLoading(false);
        }
    }
    async function saveFeatures() {
        if (!config) return;
        setNotice(
            "Feature switches are currently read-only until the instance settings API accepts feature updates.",
        );
    }
    return (
        <AdminLayout
            title="Instance settings"
            description="Configure settings that apply to the entire imshare instance."
            activeHref="/admin/settings/"
        >
            {error ? <Alert severity="error">{error}</Alert> : null}
            {notice ? (
                <Alert severity="success" onClose={() => setNotice("")}>
                    {notice}
                </Alert>
            ) : null}
            <Stack spacing={2}>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">Instance</Typography>
                            <TextField
                                label="Site name"
                                value={config?.site.name ?? ""}
                                slotProps={{ input: { readOnly: true } }}
                            />
                            <TextField
                                label="Description"
                                value={config?.site.description ?? ""}
                                slotProps={{ input: { readOnly: true } }}
                                multiline
                                minRows={2}
                            />
                            <TextField
                                label="Version"
                                value={config?.site.version ?? ""}
                                slotProps={{ input: { readOnly: true } }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                Site identity is currently configured from the instance
                                configuration file. Runtime-editable settings are separated below.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">Registration & access</Typography>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={config?.auth.emailAndPasswordEnabled ?? false}
                                        onChange={(e) =>
                                            setConfig((c) =>
                                                c
                                                    ? {
                                                          ...c,
                                                          auth: {
                                                              ...c.auth,
                                                              emailAndPasswordEnabled:
                                                                  e.target.checked,
                                                          },
                                                      }
                                                    : c,
                                            )
                                        }
                                    />
                                }
                                label="Enable email/password authentication"
                            />
                            <Select
                                value={registrationMode()}
                                onChange={(e) =>
                                    setRegistrationMode(e.target.value as RegistrationMode)
                                }
                                fullWidth
                            >
                                <MenuItem value="disabled">Registration disabled</MenuItem>
                                <MenuItem value="open">Open registration</MenuItem>
                                <MenuItem value="token">
                                    Registration access token required
                                </MenuItem>
                            </Select>
                            <Typography variant="body2" color="text.secondary">
                                Open allows anyone to register. Token-required registration uses the
                                instance registration access token. Approval-required registration
                                will need its own pending-account workflow rather than silently
                                treating new users as active.
                            </Typography>
                            <TextField
                                label="Current registration access token"
                                value={registrationToken?.token ?? ""}
                                slotProps={{ input: { readOnly: true } }}
                                helperText={
                                    registrationToken
                                        ? `Expires ${new Date(registrationToken.expiresAt).toLocaleString()}`
                                        : ""
                                }
                                fullWidth
                            />
                            <Button variant="contained" onClick={() => void save("auth")}>
                                Save registration settings
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">Email / SMTP</Typography>
                            <Typography variant="body2" color="text.secondary">
                                SMTP credentials stay in the server environment. Enter a recipient
                                below to verify that the configured SMTP server can authenticate and
                                send mail.
                            </Typography>
                            <TextField
                                label="Test recipient"
                                type="email"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="you@example.com"
                                fullWidth
                            />
                            <Button
                                variant="contained"
                                onClick={() => void sendTestEmail()}
                                disabled={mailLoading || !recipient.trim()}
                            >
                                {mailLoading ? "Sending…" : "Send test email"}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">Analytics</Typography>
                            <TextField
                                label="Google Analytics 4 measurement ID"
                                value={ga}
                                onChange={(e) => setGa(e.target.value)}
                                placeholder="G-XXXXXXXXXX"
                            />
                            <TextField
                                label="Google Tag Manager container ID"
                                value={gtm}
                                onChange={(e) => setGtm(e.target.value)}
                                placeholder="GTM-XXXXXXX"
                            />
                            <Button variant="contained" onClick={() => void save("analytics")}>
                                Save analytics
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">Features & discovery</Typography>
                            <Typography variant="body2" color="text.secondary">
                                These controls describe instance capabilities such as public
                                profiles, public posts, search, recommendations, notifications,
                                sitemap, and robots. Feature flags are loaded from the instance
                                configuration.
                            </Typography>
                            {Object.entries(config?.features ?? {}).map(([key, enabled]) => (
                                <FormControlLabel
                                    key={key}
                                    control={<Checkbox checked={enabled} disabled />}
                                    label={`${key}: ${enabled ? "enabled" : "disabled"}`}
                                />
                            ))}
                            <Button
                                variant="outlined"
                                disabled={!config}
                                onClick={() => void saveFeatures()}
                            >
                                Feature configuration
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6">Content limits</Typography>
                            <TextField
                                label="Maximum text post characters"
                                value={String(config?.limits?.textPostCharacters ?? "")}
                                slotProps={{ input: { readOnly: true } }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                Limits are currently exposed for inspection. Changing them should be
                                added to the same validated server settings API before making this
                                field editable.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={1}>
                            <Typography variant="h6">ActivityPub / federation</Typography>
                            <Typography color="text.secondary">
                                Federation settings remain separate from ordinary profile privacy.
                                Public profiles and posts can be exposed for federation according to
                                instance policy; private or hidden account data should not be
                                exported.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </AdminLayout>
    );
}
const root = document.querySelector("#admin-settings-page");
if (root)
    createRoot(root).render(
        <App>
            <AdminSettingsPage />
        </App>,
    );
