import { Alert, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { User } from "../lib/types";

function DashboardPage() {
    const [user, setUser] = useState<User | false | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        void api<{ data: User }>("/v1/me")
            .then((response) => setUser(response.data))
            .catch((cause) => {
                if ((cause as Error & { status?: number }).status === 401) setUser(false);
                else setError(cause instanceof Error ? cause.message : "Unable to load dashboard.");
            });
    }, []);

    if (user === null) return <Page><LoadingState label="Loading dashboard…" /></Page>;
    if (error) return <Page><Alert severity="error">{error}</Alert></Page>;
    if (user === false) return <Page><Card variant="outlined"><CardContent><Typography variant="h4" component="h1">Dashboard</Typography><Typography paragraph>Sign in to manage your content.</Typography><Button variant="contained" component="a" href="/account/login/">Log in</Button></CardContent></Card></Page>;

    return <Page><Stack spacing={2}><Typography variant="h4" component="h1">Dashboard</Typography><Typography color="text.secondary">Welcome back, {user.name || "user"}.</Typography><Stack direction="row" spacing={1} flexWrap="wrap"><Button variant="contained" component="a" href="/posts/new/">New post</Button><Button variant="outlined" component="a" href="/dashboard/posts/">Manage posts</Button><Button variant="outlined" component="a" href="/dashboard/tags/">Manage tags</Button><Button variant="outlined" component="a" href="/dashboard/categories/">Manage categories</Button><Button variant="outlined" component="a" href="/dashboard/settings/">Settings</Button></Stack></Stack></Page>;
}

const root = document.querySelector("#dashboard-page");
if (root) createRoot(root).render(<App><DashboardPage /></App>);
