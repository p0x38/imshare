import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { getSession } from "./lib/api.js";
import { setRealtimeServer } from "./lib/realtime.js";

export function attachRealtime(server: HttpServer): Server {
  const io = new Server(server, {
    path: "/socket.io",
    serveClient: true,
    cors: { origin: true, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const headers = new Headers();
      const cookie = socket.handshake.headers.cookie;
      if (cookie) headers.set("cookie", cookie);
      const session = await getSession({ headers } as never);
      socket.data.userId = session?.user.id;
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket) => {
    socket.on("post:subscribe", (postId: unknown) => {
      if (typeof postId !== "string" || postId.length > 128) return;
      void socket.join(`post:${postId}`);
    });

    socket.on("post:unsubscribe", (postId: unknown) => {
      if (typeof postId !== "string" || postId.length > 128) return;
      void socket.leave(`post:${postId}`);
    });
  });

  setRealtimeServer(io);
  return io;
}
