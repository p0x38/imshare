import { Delete } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Token = {
    id: string; name: string; tokenPrefix: string;
    permissions: Record<string, string[]>; enabled: boolean;
    expiresAt: string | null; lastUsedAt: string | null; createdAt: string;
};

const resources = ["posts", "uploads", "users", "comments", "tags", "categories", "notifications", "me"];

export function ApiTokens() {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [name, setName] = useState("");
    const [secret, setSecret] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [readAll, setReadAll] = useState(true);
    const [writePosts, setWritePosts] = useState(false);

    async function load() {
        try {
            setTokens((await api<{ data: Token[] }>("/v1/me/api-tokens")).data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to load API tokens.");
        }
    }
    useEffect(() => { void load(); }, []);

    async function create() {
        if (!name.trim()) return;
        setBusy(true); setError(""); setSecret("");
        try {
            const permissions: Record<string, string[]> = {};
            if (readAll) for (const resource of resources) permissions[resource] = ["read"];
            if (writePosts) permissions.posts = [...new Set([...(permissions.posts ?? []), "write"])];
            const result = await api<{ data: Token & { token: string } }>("/v1/me/api-tokens", {
                method: "POST", body: JSON.stringify({ name, permissions }),
            });
            setSecret(result.data.token);
            setName("");
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to create API token.");
        } finally { setBusy(false); }
    }

    async function revoke(id: string) {
        if (!confirm("Revoke this API token? It cannot be recovered.")) return;
        try {
            await api("/v1/me/api-tokens/" + encodeURIComponent(id), { method: "DELETE" });
            await load();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to revoke API token.");
        }
    }

    return <Stack spacing={2}>
        <Card variant="outlined"><CardContent><Stack spacing={2}>
            <Typography variant="h6">API tokens</Typography>
            <Typography variant="body2" color="text.secondary">
                API tokens are credentials for external clients to read or modify your imshare data.
                The secret is shown only once when a token is created.
            </Typography>
            {secret && <Alert severity="warning">
                <Stack spacing={1}>
                    <Typography>Copy this token now. It will not be shown again.</Typography>
                    <TextField fullWidth value={secret} slotProps={{ input: { readOnly: true } }} />
                </Stack>
            </Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Token name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My CLI" />
            <FormControlLabel control={<Checkbox checked={readAll} onChange={(e) => setReadAll(e.target.checked)} />} label="Read access to standard resources" />
            <FormControlLabel control={<Checkbox checked={writePosts} onChange={(e) => setWritePosts(e.target.checked)} />} label="Create and modify posts" />
            <Button variant="contained" onClick={() => void create()} disabled={busy || !name.trim()}>Create token</Button>
        </Stack></CardContent></Card>
        <Stack spacing={1}>
            {tokens.map((token) => <Card key={token.id} variant="outlined"><CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Stack>
                        <Typography variant="subtitle1">{token.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {token.tokenPrefix} · {token.enabled ? "Enabled" : "Disabled"}{token.lastUsedAt ? " · Last used " + new Date(token.lastUsedAt).toLocaleString() : ""}
                        </Typography>
                    </Stack>
                    <Button color="error" startIcon={<Delete />} onClick={() => void revoke(token.id)}>Revoke</Button>
                </Stack>
            </CardContent></Card>)}
            {tokens.length === 0 && <Typography color="text.secondary">No API tokens.</Typography>}
        </Stack>
    </Stack>;
}
