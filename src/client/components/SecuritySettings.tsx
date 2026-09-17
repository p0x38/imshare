import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";

import { authClient } from "../lib/auth-client";
import { ConnectedAccounts } from "./ConnectedAccounts";

export function SecuritySettings() {
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [totpUri, setTotpUri] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    async function enable() {
        setLoading(true); setError(""); setNotice("");
        const result = await authClient.twoFactor.enable({ password, method: "totp" });
        if (result.error) setError(result.error.message || "Unable to start TOTP enrollment.");
        else if (result.data?.method === "totp") { setTotpUri(result.data.totpURI); setBackupCodes(result.data.backupCodes); setNotice("Scan the TOTP URI with your authenticator app, then enter the generated code below."); }
        setLoading(false);
    }

    async function verify() {
        setLoading(true); setError("");
        const result = await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: true });
        if (result.error) setError(result.error.message || "Unable to verify the authenticator code.");
        else { setEnabled(true); setNotice("Two-factor authentication is enabled."); }
        setLoading(false);
    }

    async function disable() {
        setLoading(true); setError("");
        const result = await authClient.twoFactor.disable({ password });
        if (result.error) setError(result.error.message || "Unable to disable two-factor authentication.");
        else { setEnabled(false); setTotpUri(""); setBackupCodes([]); setNotice("Two-factor authentication is disabled."); }
        setLoading(false);
    }

    async function regenerate() {
        setLoading(true); setError("");
        const result = await authClient.twoFactor.generateBackupCodes({ password });
        if (result.error) setError(result.error.message || "Unable to generate recovery codes.");
        else if (result.data) { setBackupCodes(result.data.backupCodes); setNotice("New recovery codes generated. The previous codes are no longer valid."); }
        setLoading(false);
    }

    return (
        <Stack spacing={2}>
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h6">Authenticator & recovery</Typography>
                        <Typography variant="body2" color="text.secondary">Use an authenticator app for sign-in verification. Recovery codes can be used if you lose access to the authenticator.</Typography>
                        <TextField label="Account password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                        {!enabled && !totpUri ? <Button variant="contained" onClick={() => void enable()} disabled={loading || !password}>Set up authenticator</Button> : null}
                        {totpUri ? <><TextField label="TOTP setup URI" value={totpUri} slotProps={{ input: { readOnly: true } }} multiline minRows={3} helperText="Keep this URI private. It contains the authenticator secret." /><TextField label="Authenticator code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputProps={{ inputMode: "numeric" }} /><Button variant="contained" onClick={() => void verify()} disabled={loading || code.trim().length < 6}>Verify and enable</Button></> : null}
                        {enabled ? <><Button variant="outlined" onClick={() => void regenerate()} disabled={loading || !password}>Regenerate recovery codes</Button><Button color="error" variant="outlined" onClick={() => void disable()} disabled={loading || !password}>Disable authenticator</Button></> : null}
                        {backupCodes.length ? <Alert severity="warning"><Stack spacing={1}><Typography>Save these recovery codes somewhere secure. Each code can be used once.</Typography>{backupCodes.map((item) => <Typography key={item} component="code">{item}</Typography>)}</Stack></Alert> : null}
                        {error ? <Alert severity="error">{error}</Alert> : null}{notice ? <Alert severity="success">{notice}</Alert> : null}
                    </Stack>
                </CardContent>
            </Card>
            <ConnectedAccounts />
        </Stack>
    );
}
