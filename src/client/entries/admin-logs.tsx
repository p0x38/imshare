import { Alert, Card, CardContent, Pagination, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";
interface Log {
    id: string;
    action: string;
    reason: string | null;
    createdAt: string;
    expiresAt: string | null;
    actor: { name: string; handle: string | null };
    targetUser: { name: string; handle: string | null };
}
function AdminLogsPage() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    useEffect(() => {
        void (async () => {
            try {
                const response = await api<{ data: { logs: Log[]; total: number } }>(
                    `/v1/admin/logs?limit=100&offset=${(page - 1) * 100}`,
                );
                setLogs(response.data.logs);
                setTotal(response.data.total);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to load moderation log.");
            }
        })();
    }, [page]);
    return (
        <AdminLayout
            title="Moderation log"
            description="Audit moderation actions performed by staff."
            activeHref="/admin/logs/"
        >
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack spacing={1}>
                {logs.map((log) => (
                    <Card variant="outlined" key={log.id}>
                        <CardContent>
                            <Stack spacing={0.5}>
                                <Typography>
                                    <strong>{log.action}</strong> · {log.targetUser.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    by {log.actor.name} · {new Date(log.createdAt).toLocaleString()}
                                </Typography>
                                {log.reason ? (
                                    <Typography variant="body2">{log.reason}</Typography>
                                ) : null}
                                {log.expiresAt ? (
                                    <Typography variant="caption">
                                        Expires: {new Date(log.expiresAt).toLocaleString()}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </Stack>
            {total > 100 ? <Stack alignItems="center" sx={{ pt: 1 }}><Pagination count={Math.ceil(total / 100)} page={page} onChange={(_, value) => setPage(value)} showFirstButton showLastButton /></Stack> : null}
        </AdminLayout>
    );
}
const root = document.querySelector("#admin-logs-page");
if (root)
    createRoot(root).render(
        <App>
            <AdminLogsPage />
        </App>,
    );
