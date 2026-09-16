import { Alert, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";

interface User { id: string; name: string; handle: string | null; email: string; role: string; isBanned: boolean; banReason: string | null; bannedUntil: string | null; createdAt: string; }

function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState("");
    const [target, setTarget] = useState<User | null>(null);
    const [action, setAction] = useState<"ban" | "kick" | "unban" | null>(null);
    const [duration, setDuration] = useState("24");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    async function load() {
        try { setUsers((await api<{ data: User[] }>("/v1/admin/users?limit=100")).data); }
        catch (e) { setError(e instanceof Error ? e.message : "Failed to load users."); }
    }
    useEffect(() => { void load(); }, []);

    async function submit() {
        if (!target || !action) return;
        setBusy(true); setError("");
        try {
            const path = `/v1/admin/users/${encodeURIComponent(target.id)}/${action}`;
            const body = action === "ban" ? JSON.stringify({ reason: reason.trim(), durationHours: Number(duration) }) : undefined;
            await api(path, { method: action === "unban" ? "POST" : "POST", body });
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
                        <Button size="small" variant="outlined" disabled={user.isBanned} onClick={() => { setTarget(user); setAction("kick"); }}>Kick</Button>
                        {user.isBanned ? <Button size="small" variant="outlined" onClick={() => { setTarget(user); setAction("unban"); }}>Unban</Button> : <Button size="small" color="error" variant="outlined" onClick={() => { setTarget(user); setAction("ban"); }}>Ban</Button>}
                    </Stack>
                </Stack>
            </CardContent></Card>)}
        </Stack>
        <Dialog open={Boolean(target && action)} onClose={() => !busy && setAction(null)} fullWidth maxWidth="sm">
            <DialogTitle>{action === "ban" ? "Ban user" : action === "kick" ? "Kick user" : "Unban user"}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography>Target: {target?.name}</Typography>
                    {action === "ban" ? <>
                        <TextField select label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)} fullWidth>
                            <MenuItem value="1">1 hour</MenuItem><MenuItem value="24">24 hours</MenuItem><MenuItem value="168">7 days</MenuItem><MenuItem value="720">30 days</MenuItem><MenuItem value="8760">1 year</MenuItem><MenuItem value="0">Permanent</MenuItem>
                        </TextField>
                        <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={3} required fullWidth />
                    </> : null}
                </Stack>
            </DialogContent>
            <DialogActions><Button onClick={() => setAction(null)} disabled={busy}>Cancel</Button><Button onClick={() => void submit()} disabled={busy || (action === "ban" && !reason.trim())} color={action === "ban" ? "error" : "primary"} variant="contained">Confirm</Button></DialogActions>
        </Dialog>
    </AdminLayout>;
}

const root = document.querySelector("#admin-users-page");
if (root) createRoot(root).render(<App><AdminUsersPage /></App>);
