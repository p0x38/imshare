import { Alert, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { User } from "../lib/types";
function DashboardPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | false | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        void api<{ data: User }>("/v1/me")
            .then((response) => setUser(response.data))
            .catch((cause) => {
                if ((cause as Error & { status?: number }).status === 401) setUser(false);
                else
                    setError(cause instanceof Error ? cause.message : t("dashboardPage.loadError"));
            });
    }, [t]);
    if (user === null)
        return (
            <Page>
                <LoadingState label={t("dashboardPage.loading")} />
            </Page>
        );
    if (error)
        return (
            <Page>
                <Alert severity="error">{error}</Alert>
            </Page>
        );
    if (user === false)
        return (
            <Page>
                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="h4" component="h1">
                            {t("dashboardPage.dashboard")}
                        </Typography>
                        <Typography paragraph>{t("dashboardPage.signInMessage")}</Typography>
                        <Button variant="contained" component="a" href="/account/login/">
                            {t("accountPage.logIn")}
                        </Button>
                    </CardContent>
                </Card>
            </Page>
        );
    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {t("dashboardPage.dashboard")}
                </Typography>
                <Typography color="text.secondary">
                    {t("dashboardPage.welcomeBack", { name: user.name || t("common.user") })}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="contained" component="a" href="/posts/new/">
                        {t("dashboardPage.newPost")}
                    </Button>
                    <Button variant="outlined" component="a" href="/dashboard/analytics/">Analytics</Button>
                    <Button variant="outlined" component="a" href="/dashboard/posts/">
                        {t("dashboardPage.managePosts")}
                    </Button>
                    <Button variant="outlined" component="a" href="/dashboard/tags/">
                        {t("dashboardPage.manageTags")}
                    </Button>
                    <Button variant="outlined" component="a" href="/dashboard/categories/">
                        {t("dashboardPage.manageCategories")}
                    </Button>
                    <Button variant="outlined" component="a" href="/dashboard/settings/">
                        {t("dashboardPage.settings")}
                    </Button>
                </Stack>
            </Stack>
        </Page>
    );
}
const root = document.querySelector("#dashboard-page");
if (root)
    createRoot(root).render(
        <App>
            <DashboardPage />
        </App>,
    );
