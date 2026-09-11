import { prisma } from "./auth.js";
import { broadcastNotification } from "./realtime.js";

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
    broadcastNotification(notification.recipientId, {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
        actor: notification.actor,
        postId: notification.postId,
        commentId: notification.commentId,
    });
    return notification;
}
