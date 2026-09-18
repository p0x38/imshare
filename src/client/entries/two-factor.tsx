import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { authClient } from "../lib/auth-client";

function TwoFactorPage() {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [backup, setBackup] = useState(false);

    async function verify(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError("");
        const result = backup
            ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: true })
            : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: true });
        if (result.error) setError(result.error.message || "Verification failed.");
        else location.href = "/dashboard/";
        setLoading(false);
    }

    return (
        <Page maxWidth="sm">
            <Card variant="outlined">
                <CardContent>
                    <Stack component="form" spacing={2} onSubmit={(event) => void verify(event)}>
                        <Typography variant="h4" component="h1">
                            Two-factor authentication
                        </Typography>
                        <Typography color="text.secondary">
                            Enter the six-digit code from your authenticator app, or use a recovery
                            code if you cannot access it.
                        </Typography>
                        <TextField
                            label={backup ? "Recovery code" : "Authenticator code"}
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            autoComplete="one-time-code"
                            inputProps={{ inputMode: "numeric" }}
                            required
                        />
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        <Button type="submit" variant="contained" disabled={loading}>
                            {loading ? "Verifying…" : "Verify"}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setBackup((value) => !value);
                                setCode("");
                                setError("");
                            }}
                        >
                            {backup ? "Use authenticator code" : "Use recovery code"}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Page>
    );
}

const root = document.querySelector("#two-factor-page");
if (root)
    createRoot(root).render(
        <App>
            <TwoFactorPage />
        </App>,
    );
