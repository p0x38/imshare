import { Alert, Button, Stack } from "@mui/material";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";

interface PublicConfig {
    auth: {
        oidcProviderId: string | null;
    };
}

export function OidcLoginButton() {
    const [providerId, setProviderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        void api<{ data: PublicConfig }>("/v1/config")
            .then(({ data }) => setProviderId(data.auth.oidcProviderId))
            .catch(() => setProviderId(null));
    }, []);

    if (!providerId) return null;

    async function signIn() {
        setLoading(true);
        setError("");
        try {
            await authClient.signIn.social({
                provider: providerId!,
                callbackURL: "/dashboard/",
            });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "OpenID Connect login failed.");
            setLoading(false);
        }
    }

    return (
        <Stack spacing={1}>
            <Button variant="outlined" onClick={() => void signIn()} disabled={loading} fullWidth>
                {loading ? "Redirecting…" : "Continue with OpenID Connect"}
            </Button>
            {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
    );
}
