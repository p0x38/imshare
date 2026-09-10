import type { Server } from "socket.io";

let io: Server | undefined;

export function setRealtimeServer(server: Server): void {
  io = server;
}

export function broadcastPostReaction(payload: {
  postId: string;
  type: string;
  active: boolean;
  counts: Record<string, number>;
}): void {
  io?.to(`post:${payload.postId}`).emit("post:reaction", payload);
}
