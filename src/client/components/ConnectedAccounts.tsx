import { Alert, Button, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";

interface PublicConfig {
    auth: {
        oidcProviderId: string | null;
    };
}

interface LinkedAccount {
    id: string;
    providerId: string;
    accountId: string;
}

export function ConnectedAccounts() {
    const [providerId, setProviderId] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function load() {
        setLoading(true);
        setError("");
        try {
            const [{ data: config }, accountsResult] = await Promise.all([
                api<{ data: PublicConfig }>("/v1/config"),
                authClient.listAccounts(),
            ]);
            if (accountsResult.error) throw new Error(accountsResult.error.message);
            setProviderId(config.auth.oidcProviderId);
            setAccounts((accountsResult.data ?? []) as LinkedAccount[]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to load connected accounts.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    const oidcAccount = providerId
        ? accounts.find((account) => account.providerId === providerId)
        : undefined;

    async function connect() {
        if (!providerId) return;
        setLinking(true);
        setError("");
        setNotice("");
        try {
            await authClient.linkSocial({
                provider: providerId,
                callbackURL: "/account/?tab=security",
            });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to connect the OpenID account.");
            setLinking(false);
        }
    }

    async function disconnect() {
        if (!oidcAccount) return;
        setUnlinking(true);
        setError("");
        setNotice("");
        try {
            const result = await authClient.unlinkAccount({ accountId: oidcAccount.id });
            if (result.error) throw new Error(result.error.message);
            setAccounts((current) => current.filter((account) => account.id !== oidcAccount.id));
            setNotice("OpenID Connect account disconnected.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to disconnect the OpenID account.");
        } finally {
            setUnlinking(false);
        }
    }

    if (loading) return null;
    if (!providerId) return null;

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6">Connected accounts</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Connect an OpenID Connect identity so it can be used to sign in to this account.
                    </Typography>
                    <Divider />
                    <Stack spacing={1}>
                        <Typography variant="subtitle1">OpenID Connect</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Provider: {providerId}
                        </Typography>
                        {oidcAccount ? (
                            <Stack spacing={1}>
                                <Typography variant="body2">Connected</Typography>
                                <Button
                                    color="error"
                                    variant="outlined"
                                    onClick={() => void disconnect()}
                                    disabled={unlinking}
                                >
                                    {unlinking ? "Disconnecting…" : "Disconnect OpenID Connect"}
                                </Button>
                            </Stack>
                        ) : (
                            <Button variant="contained" onClick={() => void connect()} disabled={linking}>
                                {linking ? "Redirecting…" : "Connect OpenID Connect"}
                            </Button>
                        )}
                    </Stack>
                    {error ? <Alert severity="error">{error}</Alert> : null}
                    {notice ? <Alert severity="success">{notice}</Alert> : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
