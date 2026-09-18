import webpush from "web-push";

import { env } from "./env.js";
import { prisma } from "./auth.js";

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}

function configured(): boolean {
    return Boolean(env.push.publicKey && env.push.privateKey && env.push.subject);
}

function configure(): void {
    if (!configured())
        throw new Error(
            "Web Push is not configured: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
        );
    webpush.setVapidDetails(env.push.subject!, env.push.publicKey!, env.push.privateKey!);
}

export function getPushPublicKey(): string | null {
    return env.push.publicKey ?? null;
}

export async function sendWebPushNotification(userId: string, payload: PushPayload): Promise<void> {
    if (!configured()) return;
    configure();
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    const body = JSON.stringify(payload);
    await Promise.all(
        subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
                    },
                    body,
                );
            } catch (error) {
                const statusCode =
                    typeof error === "object" && error !== null && "statusCode" in error
                        ? Number((error as { statusCode?: unknown }).statusCode)
                        : 0;
                if (statusCode === 404 || statusCode === 410) {
                    await prisma.pushSubscription.delete({ where: { id: subscription.id } });
                    return;
                }
                console.error("[push] notification delivery failed:", error);
            }
        }),
    );
}
