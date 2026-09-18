import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const host = process.env.SERVICE_UNAVAILABLE_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.SERVICE_UNAVAILABLE_PORT ?? 5455);
const statusCode = Number(process.env.SERVICE_UNAVAILABLE_STATUS ?? 503);
const reason =
    process.env.SERVICE_UNAVAILABLE_REASON?.trim() || "The service is temporarily unavailable.";
const message =
    process.env.SERVICE_UNAVAILABLE_MESSAGE?.trim() ||
    "The upstream application is currently offline or undergoing maintenance.";

if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("SERVICE_UNAVAILABLE_PORT must be an integer between 1 and 65535.");

if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599)
    throw new Error("SERVICE_UNAVAILABLE_STATUS must be an HTTP error status between 400 and 599.");

const pagePath = path.resolve(process.cwd(), "caddy", "service-unavailable.html");
const template = await readFile(pagePath, "utf8");

function render(request: IncomingMessage): string {
    const requestHost = request.headers.host ?? "";
    const requestUri = request.url ?? "/";
    const method = request.method ?? "GET";
    const time = new Date().toISOString();
    const trace = "standalone fallback server";

    return template
        .replaceAll('{{placeholder "http.vars.unavailable.status_code"}}', String(statusCode))
        .replaceAll('{{placeholder "http.vars.unavailable.status_text"}}', statusText(statusCode))
        .replaceAll('{{placeholder "http.vars.unavailable.reason"}}', escapeHtml(reason))
        .replaceAll('{{placeholder "http.vars.unavailable.message"}}', escapeHtml(message))
        .replaceAll('{{placeholder "http.vars.unavailable.trace"}}', escapeHtml(trace))
        .replaceAll('{{placeholder "http.vars.unavailable.error_id"}}', "not available")
        .replaceAll('{{placeholder "http.request.method"}}', escapeHtml(method))
        .replaceAll('{{placeholder "http.request.uri"}}', escapeHtml(requestUri))
        .replaceAll('{{placeholder "http.request.host"}}', escapeHtml(requestHost))
        .replaceAll('{{now | date "2006-01-02 15:04:05 MST"}}', time);
}

function statusText(code: number): string {
    return (
        {
            500: "Internal Server Error",
            502: "Bad Gateway",
            503: "Service Unavailable",
            504: "Gateway Timeout",
        }[code] ?? "Service Unavailable"
    );
}

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
            character,
    );
}

const server = createServer((request, response: ServerResponse) => {
    const body = render(request);

    response.writeHead(statusCode, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
    });

    response.end(body);
});

server.listen(port, host, () => {
    console.log(
        "Service-unavailable fallback listening on http://" +
            (host.includes(":") ? "[" + host + "]" : host) +
            ":" +
            port,
    );
    console.log("Serving " + pagePath);
    console.log("Press Ctrl+C to stop.");
});

function shutdown(signal: string): void {
    console.log("\\nReceived " + signal + ", stopping fallback server.");
    server.close((error) => {
        if (error) {
            console.error(error);
            process.exitCode = 1;
        }
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
