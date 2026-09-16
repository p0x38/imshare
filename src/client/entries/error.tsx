import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";

function ErrorPage() {
    const status = Number(document.body.dataset.status) || 500;
    const title = document.body.dataset.title || (status === 404 ? "Page not found" : "Something went wrong");
    const message = document.body.dataset.message || "The requested resource could not be served.";

    return (
        <Page maxWidth="sm">
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="overline" color="text.secondary">HTTP {status}</Typography>
                        <Typography variant="h4" component="h1">{title}</Typography>
                        <Typography color="text.secondary">{message}</Typography>
                        <Button variant="contained" component="a" href="/">Back to imshare</Button>
                    </Stack>
                </CardContent>
            </Card>
        </Page>
    );
}

const root = document.querySelector("#error-page");
if (root) createRoot(root).render(<App><ErrorPage /></App>);
