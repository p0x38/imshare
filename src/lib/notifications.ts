import { prisma } from "./auth.js";
import { observability } from "../instrumentation.js";
import { broadcastNotification } from "./realtime.js";
import { sendWebPushNotification } from "./push.js";

export async function createNotification(input: {
    recipientId: string;
    actorId?: string;
    type: string;
    message: string;
    postId?: string;
    commentId?: string;
    reactionType?: string;
}) {
    if (input.actorId && input.actorId === input.recipientId) return undefined;
    const notification = await prisma.notification.create({
        data: input,
        include: { actor: { select: { id: true, name: true } } },
    });
    observability.recordResourceOperation("notifications", "create");
    const payload = {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
        actor: notification.actor,
        postId: notification.postId,
        commentId: notification.commentId,
    };
    broadcastNotification(notification.recipientId, payload);
    const url = notification.postId
        ? `/posts/${encodeURIComponent(notification.postId)}${notification.commentId ? `#comment-${encodeURIComponent(notification.commentId)}` : ""}`
        : "/account/?tab=notifications";
    void sendWebPushNotification(notification.recipientId, {
        title: notification.actor?.name ? `${notification.actor.name} on imshare` : "imshare",
        body: notification.message,
        url,
        tag: `notification-${notification.id}`,
    }).catch((error) => {
        console.error("[push] failed to deliver notification:", error);
    });
    return notification;
}
