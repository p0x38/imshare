import { Alert, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";
interface Log { id: string; action: string; reason: string | null; createdAt: string; expiresAt: string | null; actor: { name: string; handle: string | null }; targetUser: { name: string; handle: string | null }; }
function AdminLogsPage() { const [logs, setLogs] = useState<Log[]>([]); const [error, setError] = useState(""); useEffect(() => { void (async () => { try { setLogs((await api<{ data: Log[] }>("/v1/admin/logs?limit=200")).data); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load moderation log."); } })(); }, []); return <AdminLayout title="Moderation log" description="Audit moderation actions performed by staff." activeHref="/admin/logs/">{error ? <Alert severity="error">{error}</Alert> : null}<Stack spacing={1}>{logs.map((log) => <Card variant="outlined" key={log.id}><CardContent><Stack spacing={0.5}><Typography><strong>{log.action}</strong> · {log.targetUser.name}</Typography><Typography variant="body2" color="text.secondary">by {log.actor.name} · {new Date(log.createdAt).toLocaleString()}</Typography>{log.reason ? <Typography variant="body2">{log.reason}</Typography> : null}{log.expiresAt ? <Typography variant="caption">Expires: {new Date(log.expiresAt).toLocaleString()}</Typography> : null}</Stack></CardContent></Card>)}</Stack></AdminLayout>; }
const root = document.querySelector("#admin-logs-page"); if (root) createRoot(root).render(<App><AdminLogsPage /></App>);
