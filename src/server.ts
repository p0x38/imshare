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
            const output = execFileSync("tasklist.exe", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
                windowsHide: true,
            }).trim();

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
                if (processCheck === "node" || processCheck === "unknown") {
                    throw new Error(`Another instance is already running (PID ${pid}).`);
                }
            } catch (error) {
                if (error instanceof Error && error.message.startsWith("Another instance")) {
                    throw error;
                }
            }
        }

        unlinkSync(lockPath);
    }

    writeFileSync(lockPath, `${process.pid}\n`, { encoding: "utf8", flag: "wx" });
}

function releaseLock(): void {
    try {
        if (readFileSync(lockPath, "utf8").trim() === String(process.pid)) {
            unlinkSync(lockPath);
        }
    } catch {
        // Lock may already have been removed.
    }
}

acquireLock();
process.once("exit", releaseLock);
process.once("SIGINT", () => {
    releaseLock();
    process.exit(0);
});
process.once("SIGTERM", () => {
    releaseLock();
    process.exit(0);
});

const config = await loadConfig();
const app = await buildApp();
const io = attachRealtime(app.server);

const shutdown = async () => {
    await io.close();
    await app.close();
    await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
    await app.listen({ host: config.server.host, port: config.server.port });
    const registration = getRegistrationToken();
    app.log.info(`imshare listening on http://${config.server.host}:${config.server.port}`);
    app.log.info(
        `registration access token: ${registration.token} (expires ${new Date(registration.expiresAt).toISOString()})`,
    );
} catch (error) {
    app.log.error(error);
    await io.close();
    await prisma.$disconnect();
    process.exit(1);
}
