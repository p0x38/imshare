import { useEffect, useState } from "https://esm.sh/react@19.1.1?target=es2022";
import {
    Alert,
    Button,
    Card,
    CardContent,
    Container,
    Stack,
    Typography,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import { api, h, LoadingState, mount, Page } from "/react/core.js";

function DashboardPage() {
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/v1/me")
            .then((response) => setUser(response.data))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load your dashboard."));
    }, []);

    if (error) return h(Page, null, h(Alert, { severity: "error" }, error));
    if (!user) return h(Page, null, h(LoadingState, { label: "Loading dashboard…" }));

    const name = user.name || user.email || "user";
    return h(
        Page,
        null,
        h(
            Stack,
            { spacing: 2 },
            h(Typography, { variant: "h4", component: "h1" }, "Dashboard"),
            h(Typography, null, "Welcome back, ", h("strong", null, name), "."),
            h(
                Stack,
                { direction: "row", spacing: 1, useFlexGap: true, sx: { flexWrap: "wrap" } },
                h(Button, { variant: "contained", component: "a", href: "/dashboard/posts/" }, "My posts"),
                h(Button, { variant: "outlined", component: "a", href: "/dashboard/posts/new/" }, "New post"),
            ),
            h(
                Container,
                { disableGutters: true, maxWidth: false },
                h(
                    Stack,
                    { direction: { xs: "column", md: "row" }, spacing: 2 },
                    h(
                        Card,
                        { variant: "outlined", sx: { flex: 1 } },
                        h(
                            CardContent,
                            null,
                            h(Typography, { variant: "h6", component: "h2" }, "Content"),
                            h(Button, { component: "a", href: "/dashboard/posts/" }, "Manage posts"),
                            h(Button, { component: "a", href: "/dashboard/tags/" }, "Manage tags"),
                            h(Button, { component: "a", href: "/dashboard/categories/" }, "Manage categories"),
                        ),
                    ),
                    h(
                        Card,
                        { variant: "outlined", sx: { flex: 1 } },
                        h(
                            CardContent,
                            null,
                            h(Typography, { variant: "h6", component: "h2" }, "Account"),
                            h(Button, { component: "a", href: "/account/" }, "Edit your profile"),
                            h(Button, { component: "a", href: "/account/logout/" }, "Log out"),
                        ),
                    ),
                ),
            ),
        ),
    );
}

const root = document.querySelector("#dashboard-page");
if (root) mount(root, h(DashboardPage));
