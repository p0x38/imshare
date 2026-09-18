import {
    Alert,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";
import { UserBadges } from "../components/UserBadges";

interface User {
    id: string;
    name: string;
    handle: string | null;
    role: string;
    isBanned: boolean;
    banReason: string | null;
    bannedUntil: string | null;
    createdAt: string;
    manualBadges: string[];
}
type Role = "user" | "moderator" | "admin";
type Action = "ban" | "kick" | "unban" | "role" | "badges";
const manualBadgeKeys = [
    "contributor",
    "verified",
    "early-adopter",
    "bug-hunter",
    "supporter",
    "founder",
    "developer",
    "community-helper",
    "curator",
] as const;

function AdminUsersPage() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState("");
    const [target, setTarget] = useState<User | null>(null);
    const [action, setAction] = useState<Action | null>(null);
    const [duration, setDuration] = useState("24");
    const [reason, setReason] = useState("");
    const [role, setRole] = useState<Role>("user");
    const [manualBadges, setManualBadges] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            setUsers((await api<{ data: User[] }>("/v1/admin/users?limit=100")).data);
        } catch (e) {
            setError(e instanceof Error ? e.message : t("adminUsers.loadError"));
        }
    }

    useEffect(() => {
        void load();
    }, []);

    function openAction(user: User, nextAction: Action) {
        setTarget(user);
        setAction(nextAction);
        setRole(user.role === "admin" || user.role === "moderator" ? user.role : "user");
        setManualBadges(user.manualBadges ?? []);
        setReason("");
    }

    async function submit() {
        if (!target || !action) return;
        setBusy(true);
        setError("");
        try {
            const path =
                action === "role"
                    ? `/v1/admin/users/${encodeURIComponent(target.id)}/role`
                    : action === "badges"
                      ? `/v1/admin/users/${encodeURIComponent(target.id)}/badges`
                      : `/v1/admin/users/${encodeURIComponent(target.id)}/${action}`;
            const options =
                action === "role"
                    ? { method: "PATCH", body: JSON.stringify({ role }) }
                    : action === "badges"
                      ? { method: "PATCH", body: JSON.stringify({ badges: manualBadges }) }
                      : action === "ban"
                        ? {
                              method: "POST",
                              body: JSON.stringify({
                                  reason: reason.trim(),
                                  durationHours: Number(duration),
                              }),
                          }
                        : { method: "POST" };
            await api(path, options);
            setTarget(null);
            setAction(null);
            setReason("");
            setManualBadges([]);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : t("adminUsers.actionError"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AdminLayout
            title={t("adminUsers.title")}
            description={t("adminUsers.description")}
            activeHref="/admin/users/"
        >
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack spacing={1.5}>
                {users.map((user) => (
                    <Card variant="outlined" key={user.id}>
                        <CardContent>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={2}
                                alignItems={{ sm: "center" }}
                                justifyContent="space-between"
                            >
                                <Stack spacing={0.5}>
                                    <Typography variant="h6">{user.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {user.handle ? `@${user.handle}` : t("adminUsers.noHandle")}
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip size="small" label={user.role} />
                                        {user.manualBadges.length ? (
                                            <UserBadges user={{ badges: user.manualBadges }} compact />
                                        ) : null}
                                        {user.isBanned ? (
                                            <Chip
                                                size="small"
                                                color="error"
                                                label={
                                                    user.bannedUntil
                                                        ? t("adminUsers.bannedUntil", {
                                                              value: new Date(user.bannedUntil).toLocaleString(),
                                                          })
                                                        : t("adminUsers.banned")
                                                }
                                            />
                                        ) : null}
                                    </Stack>
                                    {user.isBanned && user.banReason ? (
                                        <Typography variant="body2">
                                            {t("adminUsers.reason", { value: user.banReason })}
                                        </Typography>
                                    ) : null}
                                </Stack>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Button size="small" variant="outlined" onClick={() => openAction(user, "badges")}>
                                        {t("adminUsers.changeBadges")}
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={() => openAction(user, "role")}>
                                        {t("adminUsers.changeRole")}
                                    </Button>
                                    <Button size="small" variant="outlined" disabled={user.isBanned} onClick={() => openAction(user, "kick")}>
                                        {t("adminUsers.kick")}
                                    </Button>
                                    {user.isBanned ? (
                                        <Button size="small" variant="outlined" onClick={() => openAction(user, "unban")}>
                                            {t("adminUsers.unban")}
                                        </Button>
                                    ) : (
                                        <Button size="small" color="error" variant="outlined" onClick={() => openAction(user, "ban")}>
                                            {t("adminUsers.ban")}
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </Stack>
            <Dialog
                open={Boolean(target && action)}
                onClose={() => !busy && setAction(null)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {action === "badges"
                        ? t("adminUsers.badgesTitle")
                        : action === "ban"
                          ? t("adminUsers.banTitle")
                          : action === "kick"
                            ? t("adminUsers.kickTitle")
                            : action === "unban"
                              ? t("adminUsers.unbanTitle")
                              : t("adminUsers.roleTitle")}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Typography>{t("adminUsers.target", { name: target?.name ?? "" })}</Typography>
                        {action === "badges" ? (
                            <FormControl fullWidth>
                                <InputLabel id="manual-badges-label">{t("adminUsers.badgesLabel")}</InputLabel>
                                <Select
                                    labelId="manual-badges-label"
                                    multiple
                                    value={manualBadges}
                                    label={t("adminUsers.badgesLabel")}
                                    onChange={(event) =>
                                        setManualBadges(
                                            typeof event.target.value === "string"
                                                ? event.target.value.split(",")
                                                : event.target.value,
                                        )
                                    }
                                    renderValue={(selected) => (
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {(selected as string[]).map((badge) => (
                                                <Chip
                                                    key={badge}
                                                    size="small"
                                                    label={t(`badges.items.${badge}.name`)}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                >
                                    {manualBadgeKeys.map((badge) => (
                                        <MenuItem key={badge} value={badge}>
                                            {t(`badges.items.${badge}.name`)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        {action === "role" ? (
                            <TextField
                                select
                                label={t("adminUsers.roleLabel")}
                                value={role}
                                onChange={(e) => setRole(e.target.value as Role)}
                                fullWidth
                            >
                                <MenuItem value="user">{t("adminUsers.userRole")}</MenuItem>
                                <MenuItem value="moderator">{t("adminUsers.moderatorRole")}</MenuItem>
                                <MenuItem value="admin">{t("adminUsers.adminRole")}</MenuItem>
                            </TextField>
                        ) : null}
                        {action === "ban" ? (
                            <>
                                <TextField
                                    select
                                    label={t("adminUsers.duration")}
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    fullWidth
                                >
                                    <MenuItem value="1">{t("adminUsers.oneHour")}</MenuItem>
                                    <MenuItem value="24">{t("adminUsers.oneDay")}</MenuItem>
                                    <MenuItem value="168">{t("adminUsers.sevenDays")}</MenuItem>
                                    <MenuItem value="720">{t("adminUsers.thirtyDays")}</MenuItem>
                                    <MenuItem value="8760">{t("adminUsers.oneYear")}</MenuItem>
                                    <MenuItem value="0">{t("adminUsers.permanent")}</MenuItem>
                                </TextField>
                                <TextField
                                    label={t("adminUsers.reasonLabel")}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    multiline
                                    minRows={3}
                                    required
                                    fullWidth
                                />
                            </>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAction(null)} disabled={busy}>
                        {t("common.cancel")}
                    </Button>
                    <Button
                        onClick={() => void submit()}
                        disabled={
                            busy ||
                            (action === "ban" && !reason.trim()) ||
                            (action === "role" && !role)
                        }
                        color={action === "ban" ? "error" : "primary"}
                        variant="contained"
                    >
                        {t("adminUsers.confirm")}
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}

const root = document.querySelector("#admin-users-page");
if (root) createRoot(root).render(<App><AdminUsersPage /></App>);
