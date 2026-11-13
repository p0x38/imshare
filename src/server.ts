import "./instrumentation.js";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { prisma } from "./lib/auth.js";
import { loadConfig } from "./lib/config.js";
import { getRegistrationToken } from "./lib/registration-token.js";
import { buildApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
import { startLocalAdminProxy } from "./local-admin.js";
import { startCacheCleanup } from "./lib/cache/cleanup.js";
import { startFederationInboxCleanup } from "./lib/federation/inbox/cleanup.js";
const lockPath = ".lock";

function acquireLock(): void {
    try {
        writeFileSync(lockPath, `${process.pid}\n`, {
            encoding: "utf8",
            flag: "wx",
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code == "EEXIST") {
            throw new Error(
                "An instance lock already exists. Check for a running instance and remove the stale .lock file if necessary.",
            );
        }
        throw error;
    }
}
function releaseLock(): void {
    try {
        if (readFileSync(lockPath, "utf8").trim() === String(process.pid)) unlinkSync(lockPath);
    } catch {}
}
acquireLock();
process.once("exit", releaseLock);
const config = await loadConfig();
const app = await buildApp();

const stopCacheCleanup = startCacheCleanup(config, (error) => {
    app.log.error({ err: error }, "Cache cleanup failed");
});

const stopFederationInboxCleanup = startFederationInboxCleanup(config, (error) => {
    app.log.error({ err: error }, "Federation Inbox cleanup failed");
});

const io = attachRealtime(app.server);
let localAdmin: ReturnType<typeof startLocalAdminProxy> = null;
let shuttingDown = false;
let inputConfigured = false;
function restoreInput(): void {
    if (!inputConfigured || !process.stdin.isTTY) return;
    try {
        process.stdin.setRawMode?.(false);
    } catch {}
}
const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    restoreInput();
    app.log.info(`shutting down (${reason})...`);
    try {
        localAdmin?.close();
        stopCacheCleanup();
        stopFederationInboxCleanup();
        await io.close();
        await app.observability.shutdown();
        await app.close();
        await prisma.$disconnect();
        process.exit(exitCode);
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.once("exit", restoreInput);
if (process.stdin.isTTY) {
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    inputConfigured = true;
    process.stdin.on("data", (chunk: string) => {
        for (const char of chunk) {
            if (char === "q" || char === "Q") {
                void shutdown("Q");
                return;
            }
            if (char === "\u0003") {
                void shutdown("Ctrl+C");
                return;
            }
            if (char === "\u0004") {
                void shutdown("Ctrl+D");
                return;
            }
        }
    });
}
try {
    await app.listen({ host: config.server.host, port: config.server.port });
    app.log.info(`imshare listening on http://${config.server.host}:${config.server.port}`);
    localAdmin = startLocalAdminProxy();
    if (config.auth.registration?.enabled && !config.auth.registration.public) {
        const registration = getRegistrationToken();
        app.log.info(
            `registration access token: ${registration.token} (expires ${new Date(registration.expiresAt).toISOString()})`,
        );
    }
    if (process.stdin.isTTY) app.log.info("press Q, Ctrl+C, or Ctrl+D to stop");
} catch (error) {
    app.log.error(error);
    restoreInput();
    await io.close();
    await app.observability.shutdown();
    await prisma.$disconnect();
    process.exit(1);
}
