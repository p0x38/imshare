import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { authClient } from "../lib/auth-client";

export function TwoFactorChallenge() {
    const [code, setCode] = useState("");
    const [backup, setBackup] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function verify(event: React.FormEvent) {
        event.preventDefault(); setLoading(true); setError("");
        const result = backup
            ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: true })
            : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: true });
        if (result.error) setError(result.error.message || "Verification failed.");
        else location.href = "/dashboard/";
        setLoading(false);
    }

    return <Card variant="outlined"><CardContent><Stack component="form" spacing={2} onSubmit={(event) => void verify(event)}>
        <Typography variant="h5" component="h1">Two-factor authentication</Typography>
        <Typography color="text.secondary">Enter the code from your authenticator app, or use a recovery code.</Typography>
        <TextField label={backup ? "Recovery code" : "Authenticator code"} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputProps={{ inputMode: "numeric" }} required />
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Button type="submit" variant="contained" disabled={loading}>{loading ? "Verifying…" : "Verify"}</Button>
        <Button type="button" onClick={() => { setBackup((value) => !value); setCode(""); setError(""); }}>{backup ? "Use authenticator code" : "Use recovery code"}</Button>
    </Stack></CardContent></Card>;
}
