import { Alert, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";

interface User { id: string; name: string; handle: string | null; email: string; role: string; isBanned: boolean; banReason: string | null; bannedUntil: string | null; createdAt: string; }
type Role = "user" | "moderator" | "admin";
type Action = "ban" | "kick" | "unban" | "role";

function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState("");
    const [target, setTarget] = useState<User | null>(null);
    const [action, setAction] = useState<Action | null>(null);
    const [duration, setDuration] = useState("24");
    const [reason, setReason] = useState("");
    const [role, setRole] = useState<Role>("user");
    const [busy, setBusy] = useState(false);

    async function load() {
        try { setUsers((await api<{ data: User[] }>("/v1/admin/users?limit=100")).data); }
        catch (e) { setError(e instanceof Error ? e.message : "Failed to load users."); }
    }
    useEffect(() => { void load(); }, []);

    function openAction(user: User, nextAction: Action) {
        setTarget(user);
        setAction(nextAction);
        setRole(user.role === "admin" || user.role === "moderator" ? user.role : "user");
        setReason("");
    }

    async function submit() {
        if (!target || !action) return;
        setBusy(true); setError("");
        try {
            const path = action === "role"
                ? `/v1/admin/users/${encodeURIComponent(target.id)}/role`
                : `/v1/admin/users/${encodeURIComponent(target.id)}/${action}`;
            const body = action === "ban"
                ? JSON.stringify({ reason: reason.trim(), durationHours: Number(duration) })
                : action === "role"
                  ? JSON.stringify({ role })
                  : undefined;
            await api(path, { method: "POST" === action || action === "role" ? (action === "role" ? "PATCH" : "POST") : "POST", body });
            setTarget(null); setAction(null); setReason(""); await load();
        } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
        finally { setBusy(false); }
    }

    return <AdminLayout title="Users" description="Manage accounts, moderation status, and roles." activeHref="/admin/users/">
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Stack spacing={1.5}>
            {users.map((user) => <Card variant="outlined" key={user.id}><CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <Stack spacing={0.5}>
                        <Typography variant="h6">{user.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{user.handle ? `@${user.handle} · ` : ""}{user.email}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap"> <Chip size="small" label={user.role} /> {user.isBanned ? <Chip size="small" color="error" label={user.bannedUntil ? `Banned until ${new Date(user.bannedUntil).toLocaleString()}` : "Banned"} /> : null}</Stack>
                        {user.isBanned && user.banReason ? <Typography variant="body2">Reason: {user.banReason}</Typography> : null}
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button size="small" variant="outlined" onClick={() => openAction(user, "role")}>Change role</Button>
                        <Button size="small" variant="outlined" disabled={user.isBanned} onClick={() => openAction(user, "kick")}>Kick</Button>
                        {user.isBanned ? <Button size="small" variant="outlined" onClick={() => openAction(user, "unban")}>Unban</Button> : <Button size="small" color="error" variant="outlined" onClick={() => openAction(user, "ban")}>Ban</Button>}
                    </Stack>
                </Stack>
            </CardContent></Card>)}
        </Stack>
        <Dialog open={Boolean(target && action)} onClose={() => !busy && setAction(null)} fullWidth maxWidth="sm">
            <DialogTitle>{action === "ban" ? "Ban user" : action === "kick" ? "Kick user" : action === "unban" ? "Unban user" : "Change role"}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography>Target: {target?.name}</Typography>
                    {action === "role" ? <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} fullWidth>
                        <MenuItem value="user">User</MenuItem>
                        <MenuItem value="moderator">Moderator</MenuItem>
                        <MenuItem value="admin">Administrator</MenuItem>
                    </TextField> : null}
                    {action === "ban" ? <>
                        <TextField select label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)} fullWidth>
                            <MenuItem value="1">1 hour</MenuItem><MenuItem value="24">24 hours</MenuItem><MenuItem value="168">7 days</MenuItem><MenuItem value="720">30 days</MenuItem><MenuItem value="8760">1 year</MenuItem><MenuItem value="0">Permanent</MenuItem>
                        </TextField>
                        <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={3} required fullWidth />
                    </> : null}
                </Stack>
            </DialogContent>
            <DialogActions><Button onClick={() => setAction(null)} disabled={busy}>Cancel</Button><Button onClick={() => void submit()} disabled={busy || (action === "ban" && !reason.trim()) || (action === "role" && !role)} color={action === "ban" ? "error" : "primary"} variant="contained">Confirm</Button></DialogActions>
        </Dialog>
    </AdminLayout>;
}

const root = document.querySelector("#admin-users-page");
if (root) createRoot(root).render(<App><AdminUsersPage /></App>);
