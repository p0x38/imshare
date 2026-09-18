import {
    Computer,
    Key,
    Lock,
    Logout,
    Security,
    Shield,
    Smartphone,
} from "@mui/icons-material";
import {
    Alert,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControlLabel,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { SecuritySettings } from "./SecuritySettings";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";

interface SessionInfo {
    id: string;
    expiresAt: string | Date;
    createdAt: string | Date;
    updatedAt: string | Date;
    ipAddress?: string | null;
    userAgent?: string | null;
    current: boolean;
    approximateLocation?: { city?: string; region?: string; country?: string; privacyLabels?: string[] } | null;
}

function asDate(value: string | Date): Date {
    return value instanceof Date ? value : new Date(value);
}

function formatDate(value: string | Date): string {
    return asDate(value).toLocaleString();
}

function formatApproximateLocation(location: SessionInfo["approximateLocation"]): string | null {
    if (!location) return null;
    return [location.city, location.region, location.country].filter(Boolean).join(", ") || null;
}

function describeUserAgent(userAgent: string | null | undefined): string {
    if (!userAgent) return "Unknown device";

    const browser = userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Edg/")
          ? "Edge"
          : userAgent.includes("Chrome/")
            ? "Chrome"
            : userAgent.includes("Safari/")
              ? "Safari"
              : userAgent.includes("OPR/")
                ? "Opera"
                : "Browser";

    const device = /iPhone|iPad|Android/i.test(userAgent)
        ? "Mobile"
        : /Windows/i.test(userAgent)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(userAgent)
            ? "macOS"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "Device";

    return `${browser} on ${device}`;
}

function DeviceIcon({ userAgent }: { userAgent?: string | null }) {
    return /iPhone|iPad|Android/i.test(userAgent ?? "") ? <Smartphone /> : <Computer />;
}

export function DevicesSecurity() {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [revokingOthers, setRevokingOthers] = useState(false);
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [revokeOnPasswordChange, setRevokeOnPasswordChange] = useState(true);
    const [changingPassword, setChangingPassword] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function loadSessions() {
        setLoading(true);
        setError("");
        try {
            const result = await api<{ data: SessionInfo[] }>("/v1/me/sessions?limit=100");
            setSessions(result.data ?? []);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load active sessions.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadSessions();
    }, []);

    const activeSessions = useMemo(
        () => sessions.filter((session) => asDate(session.expiresAt).getTime() > Date.now()),
        [sessions],
    );

    async function revokeSession(sessionId: string, isCurrent: boolean) {
        setRevoking(sessionId);
        setError("");
        setNotice("");
        try {
            await api<{ data: { revoked: boolean } }>(
                `/v1/me/sessions/${encodeURIComponent(sessionId)}`,
                { method: "DELETE" },
            );
            if (isCurrent) {
                window.location.assign("/account/login/");
                return;
            }
            setSessions((current) => current.filter((session) => session.id !== sessionId));
            setNotice("The selected session has been signed out.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to revoke the session.");
        } finally {
            setRevoking(null);
        }
    }

    async function revokeOtherSessions() {
        const otherSessions = activeSessions.filter((session) => !session.current);
        if (!otherSessions.length) return;

        setRevokingOthers(true);
        setError("");
        setNotice("");
        try {
            await Promise.all(
                otherSessions.map((session) =>
                    api<{ data: { revoked: boolean } }>(
                        `/v1/me/sessions/${encodeURIComponent(session.id)}`,
                        { method: "DELETE" },
                    ),
                ),
            );
            await loadSessions();
            setNotice("All other sessions have been signed out.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to sign out other sessions.");
        } finally {
            setRevokingOthers(false);
        }
    }

    async function changePassword() {
        setError("");
        setNotice("");
        if (!password || !newPassword) {
            setError("Enter your current password and a new password.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("The new passwords do not match.");
            return;
        }

        setChangingPassword(true);
        try {
            const result = await authClient.changePassword({
                currentPassword: password,
                newPassword,
                revokeOtherSessions: revokeOnPasswordChange,
            });
            if (result.error) throw new Error(result.error.message);
            setPassword("");
            setNewPassword("");
            setConfirmPassword("");
            await loadSessions();
            setNotice("Your password has been changed.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to change your password.");
        } finally {
            setChangingPassword(false);
        }
    }

    return (
        <Stack spacing={2}>
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Shield color="primary" />
                            <Stack>
                                <Typography variant="h5" component="h2">Devices & security</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Review where your account is signed in and manage your authentication settings.
                                </Typography>
                            </Stack>
                        </Stack>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        {notice ? <Alert severity="success">{notice}</Alert> : null}
                    </Stack>
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Security />
                            <Typography variant="h6" component="h2">Active devices</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            These are the active sessions currently associated with your account.
                        </Typography>
                        {loading ? <Typography color="text.secondary">Loading sessions…</Typography> : null}
                        {!loading && !activeSessions.length ? (
                            <Alert severity="info">No active sessions were found.</Alert>
                        ) : null}
                        {!loading
                            ? activeSessions.map((session, index) => {
                                  const isCurrent = session.current;
                                  return (
                                      <Stack key={session.id} spacing={1.25}>
                                          {index > 0 ? <Divider /> : null}
                                          <Stack
                                              direction={{ xs: "column", sm: "row" }}
                                              spacing={2}
                                              alignItems={{ xs: "flex-start", sm: "center" }}
                                              justifyContent="space-between"
                                          >
                                              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                                                  <DeviceIcon userAgent={session.userAgent} />
                                                  <Stack sx={{ minWidth: 0 }}>
                                                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                          <Typography variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>
                                                              {describeUserAgent(session.userAgent)}
                                                          </Typography>
                                                          {isCurrent ? <Chip label="This device" size="small" color="primary" /> : null}
                                                      </Stack>
                                                      <Typography variant="body2" color="text.secondary">
                                                          {session.ipAddress || "IP address unavailable"}
                                                      </Typography>
                                                      <Typography variant="caption" color="text.secondary">
                                                          Since {formatDate(session.createdAt)} · Expires {formatDate(session.expiresAt)}
                                                      </Typography>
                                                      {formatApproximateLocation(session.approximateLocation) ? (
                                                          <Typography variant="caption" color="text.secondary">
                                                              Approx. location: {formatApproximateLocation(session.approximateLocation)}
                                                          </Typography>
                                                      ) : null}
                                                      {session.approximateLocation?.privacyLabels?.length ? (
                                                          <Stack direction="row" spacing={0.75} flexWrap="wrap">
                                                              {session.approximateLocation.privacyLabels.map((label) => (
                                                                  <Chip key={label} label={label} size="small" variant="outlined" />
                                                              ))}
                                                          </Stack>
                                                      ) : null}
                                                  </Stack>
                                              </Stack>
                                              <Button
                                                  variant={isCurrent ? "text" : "outlined"}
                                                  color={isCurrent ? "error" : "inherit"}
                                                  startIcon={<Logout />}
                                                  onClick={() => void revokeSession(session.id, isCurrent)}
                                                  disabled={revoking === session.id}
                                              >
                                                  {revoking === session.id
                                                      ? "Signing out…"
                                                      : isCurrent
                                                        ? "Sign out"
                                                        : "Revoke"}
                                              </Button>
                                          </Stack>
                                      </Stack>
                                  );
                              })
                            : null}
                        <Button
                            color="error"
                            variant="outlined"
                            startIcon={<Logout />}
                            onClick={() => void revokeOtherSessions()}
                            disabled={revokingOthers || activeSessions.filter((session) => !session.current).length === 0}
                        >
                            {revokingOthers ? "Signing out other devices…" : "Sign out all other devices"}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Key />
                            <Typography variant="h6" component="h2">Password</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            Change the password used for email and password sign-in.
                        </Typography>
                        <input
                            type="password"
                            aria-hidden="true"
                            tabIndex={-1}
                            autoComplete="off"
                            style={{ display: "none" }}
                        />
                        <Stack spacing={2}>
                            <label>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>Current password</Typography>
                                <input
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    type="password"
                                    autoComplete="current-password"
                                    style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", font: "inherit", borderRadius: 8, border: "1px solid currentColor" }}
                                />
                            </label>
                            <label>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>New password</Typography>
                                <input
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    type="password"
                                    autoComplete="new-password"
                                    style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", font: "inherit", borderRadius: 8, border: "1px solid currentColor" }}
                                />
                            </label>
                            <label>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>Confirm new password</Typography>
                                <input
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    type="password"
                                    autoComplete="new-password"
                                    style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", font: "inherit", borderRadius: 8, border: "1px solid currentColor" }}
                                />
                            </label>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={revokeOnPasswordChange}
                                        onChange={(event) => setRevokeOnPasswordChange(event.target.checked)}
                                    />
                                }
                                label="Sign out other devices when the password changes"
                            />
                            <Button
                                variant="contained"
                                startIcon={<Lock />}
                                onClick={() => void changePassword()}
                                disabled={changingPassword || !password || !newPassword || !confirmPassword}
                            >
                                {changingPassword ? "Changing password…" : "Change password"}
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <SecuritySettings />
        </Stack>
    );
}
