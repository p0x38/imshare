import {
    Alert,
    Button,
    Card,
    CardContent,
    Chip,
    MenuItem,
    Select,
    Stack,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../lib/api";

interface Report {
    id: string;
    reason: string;
    details: string | null;
    status: string;
    createdAt: string;
    reporter: { name: string; handle: string | null };
    post: { id: string; title: string } | null;
    comment: { id: string; body: string } | null;
}

function AdminReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [status, setStatus] = useState("open");
    const [error, setError] = useState("");
    async function load() {
        try {
            setReports(
                (await api<{ data: Report[] }>(`/v1/admin/reports?status=${status}&limit=100`))
                    .data,
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load reports.");
        }
    }
    useEffect(() => {
        void load();
    }, [status]);
    async function resolve(id: string, next: "resolved" | "dismissed") {
        try {
            await api(`/v1/admin/reports/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: JSON.stringify({ status: next }),
            });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to update report.");
        }
    }
    return (
        <AdminLayout
            title="Reports"
            description="Review reports and decide how moderation should proceed."
            activeHref="/admin/reports/"
        >
            <Stack direction="row" spacing={2} alignItems="center">
                <Typography>Filter</Typography>
                <Select size="small" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="dismissed">Dismissed</MenuItem>
                </Select>
            </Stack>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack spacing={1.5}>
                {reports.map((report) => (
                    <Card variant="outlined" key={report.id}>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Stack direction="row" justifyContent="space-between" gap={2}>
                                    <Stack>
                                        <Typography variant="h6">{report.reason}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Reported by {report.reporter.name} ·{" "}
                                            {new Date(report.createdAt).toLocaleString()}
                                        </Typography>
                                    </Stack>
                                    <Chip label={report.status} />
                                </Stack>
                                <Typography>
                                    {report.details ||
                                        (report.post
                                            ? `Post: ${report.post.title}`
                                            : report.comment
                                              ? `Comment: ${report.comment.body}`
                                              : "No additional details.")}
                                </Typography>
                                {report.status === "open" ? (
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            variant="contained"
                                            onClick={() => void resolve(report.id, "resolved")}
                                        >
                                            Resolve
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            onClick={() => void resolve(report.id, "dismissed")}
                                        >
                                            Dismiss
                                        </Button>
                                    </Stack>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </AdminLayout>
    );
}
const root = document.querySelector("#admin-reports-page");
if (root)
    createRoot(root).render(
        <App>
            <AdminReportsPage />
        </App>,
    );
