import "./instrumentation.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { prisma } from "./lib/auth.js";
import { loadConfig } from "./lib/config.js";
import { getRegistrationToken } from "./lib/registration-token.js";
import { buildApp } from "./app.js";
import { attachRealtime } from "./realtime.js";
const lockPath = ".lock";
type ProcessCheck = "node" | "other" | "unknown";
function checkNodeProcess(pid: number): ProcessCheck {
    try {
        if (process.platform === "win32") {
            const output = execFileSync(
                "tasklist.exe",
                ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
                { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
            ).trim();
            if (!output || /^INFO:/i.test(output)) return "other";
            return /^"node(?:\.exe)?"\s*,/i.test(output) ? "node" : "other";
        }
        const output = execFileSync("ps", ["-p", String(pid), "-o", "comm="], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (!output) return "other";
        return /(?:^|\n)\s*node(?:js)?\s*$/i.test(output) ? "node" : "other";
    } catch {
        return "unknown";
    }
}
function acquireLock(): void {
    if (existsSync(lockPath)) {
        const pid = Number.parseInt(readFileSync(lockPath, "utf8").trim(), 10);
        if (Number.isInteger(pid) && pid > 0) {
            try {
                process.kill(pid, 0);
                const processCheck = checkNodeProcess(pid);
                if (processCheck === "node" || processCheck === "unknown")
                    throw new Error(`Another instance is already running (PID ${pid}).`);
            } catch (error) {
                if (error instanceof Error && error.message.startsWith("Another instance"))
                    throw error;
            }
        }
        unlinkSync(lockPath);
    }
    writeFileSync(lockPath, `${process.pid}\n`, { encoding: "utf8", flag: "wx" });
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
const io = attachRealtime(app.server);
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
