import { Alert, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface PushConfig { publicKey: string | null }

function base64ToBytes(value: string): Uint8Array {
    const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function PushSettings() {
    const [supported, setSupported] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
        setSupported(true);
        void api<{ data: PushConfig }>("/v1/push/config")
            .then(({ data }) => setPublicKey(data.publicKey))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load push configuration."));
        void navigator.serviceWorker.getRegistration("/push-sw.js").then(async (registration) => {
            const subscription = await registration?.pushManager.getSubscription();
            setEnabled(Boolean(subscription));
        });
    }, []);

    async function enable() {
        if (!publicKey) return;
        setLoading(true); setError("");
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
            const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
            const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
            const json = subscription.toJSON();
            if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Browser returned an incomplete push subscription.");
            await api("/v1/me/push-subscriptions", { method: "POST", body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
            setEnabled(true);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to enable browser notifications."); }
        finally { setLoading(false); }
    }

    async function disable() {
        setLoading(true); setError("");
        try {
            const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
            const subscription = await registration?.pushManager.getSubscription();
            if (subscription) {
                const response = subscription.toJSON();
                const result = await api<{ data: { removed: boolean } }>("/v1/me/push-subscriptions?endpoint=" + encodeURIComponent(response.endpoint ?? ""), { method: "DELETE" });
                void result;
                await subscription.unsubscribe();
            }
            setEnabled(false);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to disable browser notifications."); }
        finally { setLoading(false); }
    }

    if (!supported) return null;
    return <Card variant="outlined"><CardContent><Stack spacing={2}>
        <Typography variant="h6">Browser notifications</Typography>
        <Typography variant="body2" color="text.secondary">Receive imshare notifications even when the site is not open.</Typography>
        {!publicKey ? <Alert severity="info">Web Push is not configured on this instance.</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {enabled ? <Button variant="outlined" onClick={() => void disable()} disabled={loading}>Disable browser notifications</Button> : <Button variant="contained" onClick={() => void enable()} disabled={loading || !publicKey}>{loading ? "Enabling…" : "Enable browser notifications"}</Button>}
    </Stack></CardContent></Card>;
}
