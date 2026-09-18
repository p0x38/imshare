import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { getSession } from "./lib/api.js";
import { setRealtimeServer, setUserOnline, setUserOffline } from "./lib/realtime.js";
import { observability } from "./instrumentation.js";

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
        observability.recordRealtimeConnection(1);
        observability.recordRealtimeConnectionEvent("connected");
        const userId = socket.data.userId as string | undefined;
        if (userId) {
            void socket.join(`user:${userId}`);
            setUserOnline(userId);
        }

        socket.onAny((event) => observability.recordRealtimeMessage(event));

        socket.on("post:subscribe", (postId: unknown) => {
            if (typeof postId !== "string" || postId.length > 128) return;
            void socket.join(`post:${postId}`);
        });

        socket.on("post:unsubscribe", (postId: unknown) => {
            if (typeof postId !== "string" || postId.length > 128) return;
            void socket.leave(`post:${postId}`);
        });

        socket.on("disconnect", () => {
            observability.recordRealtimeConnection(-1);
            observability.recordRealtimeConnectionEvent("disconnected");
            if (userId) setUserOffline(userId);
        });
    });

    setRealtimeServer(io);
    return io;
}
