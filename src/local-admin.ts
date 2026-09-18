import { request as httpRequest, createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server as HttpServer } from "node:http";
import { loadConfigSync } from "./lib/config.js";

function upstreamHost(host: string): string {
    if (host === "0.0.0.0" || host === "::" || host === "[::]") return "127.0.0.1";
    return host.replace(/^\[|\]$/g, "");
}

export function startLocalAdminProxy(): HttpServer | null {
    const config = loadConfigSync();
    const local = config.admin?.local;
    if (local?.enabled === false) return null;

    const listenHost = local?.host ?? "127.0.0.1";
    const listenPort = local?.port ?? 5107;
    const targetHost = upstreamHost(config.server.host);
    const targetPort = config.server.port;

    const server = createServer((incoming: IncomingMessage, response: ServerResponse) => {
        const headers = { ...incoming.headers };
        headers.host = `${targetHost}:${targetPort}`;
        headers.connection = "close";

        const upstream = httpRequest(
            {
                host: targetHost,
                port: targetPort,
                method: incoming.method,
                path: incoming.url,
                headers,
            },
            (upstreamResponse) => {
                response.writeHead(
                    upstreamResponse.statusCode ?? 502,
                    upstreamResponse.statusMessage,
                    upstreamResponse.headers,
                );
                upstreamResponse.pipe(response);
            },
        );

        upstream.on("error", (error) => {
            if (!response.headersSent)
                response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
            if (!response.writableEnded)
                response.end(`Local admin proxy error: ${error.message}`);
        });
        incoming.on("aborted", () => upstream.destroy());
        incoming.pipe(upstream);
    });

    server.listen(listenPort, listenHost, () => {
        console.log(`local admin dashboard listening on http://${listenHost}:${listenPort}`);
    });
    return server;
}
