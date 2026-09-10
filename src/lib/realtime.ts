import type { Server } from "socket.io";

let io: Server | undefined;
const onlineUsers = new Map<string, number>();

export function setRealtimeServer(server: Server): void { io = server; }
export function broadcastPostReaction(payload: { postId: string; type: string; active: boolean; counts: Record<string, number> }): void { io?.to(`post:${payload.postId}`).emit("post:reaction", payload); }
export function broadcastNotification(userId: string, payload: unknown): void { io?.to(`user:${userId}`).emit("notification", payload); }
export function broadcastUploadStatus(userId: string, payload: { uploadId: string; status: "uploading" | "processing" | "ready" | "failed" | "cancelled"; progress?: number; url?: string; error?: string }): void { io?.to(`user:${userId}`).emit("upload:status", payload); }
export function setUserOnline(userId: string): void { onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1); io?.emit("presence", { userId, online: true }); }
export function setUserOffline(userId: string): void { const count = (onlineUsers.get(userId) ?? 1) - 1; if (count > 0) onlineUsers.set(userId, count); else { onlineUsers.delete(userId); io?.emit("presence", { userId, online: false }); } }
export function isUserOnline(userId: string): boolean { return (onlineUsers.get(userId) ?? 0) > 0; }
