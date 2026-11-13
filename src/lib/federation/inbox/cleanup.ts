import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "../../config.js";
import { getFederationInboxDirectory } from "../../federation.js";

interface InboxFile {
    path: string;
    size: number;
    modifiedAt: number;
}

async function collectInboxFiles(directory: string): Promise<InboxFile[]> {
    const files: InboxFile[] = [];

    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch {
        return files;
    }

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

        const filePath = path.join(directory, entry.name);

        try {
            const information = await stat(filePath);

            files.push({
                path: filePath,
                size: information.size,
                modifiedAt: information.mtimeMs,
            });
        } catch {
            // The file may have been removed concurrently.
        }
    }

    return files;
}

export async function cleanupFederationInbox(config: ServerConfig): Promise<number> {
    const retention = config.federation!.inbox!.retention!;
    const directory = getFederationInboxDirectory();

    const files = await collectInboxFiles(directory);
    const now = Date.now();

    let removed = 0;
    let totalSize = files.reduce((total, file) => total + file.size, 0);

    // Remove activities that have exceeded their retention period.
    for (const file of files) {
        if (now - file.modifiedAt <= retention.maxAgeMs!) continue;

        try {
            await unlink(file.path);
            totalSize -= file.size;
            removed++;
        } catch {
            // Another process may have removed the file.
        }
    }

    // Enforce the storage limit by removing the oldest remaining activities.
    if (totalSize > retention.maxSizeBytes!) {
        const remaining = files
            .filter((file) => now - file.modifiedAt <= retention.maxAgeMs!)
            .sort((a, b) => a.modifiedAt - b.modifiedAt);

        for (const file of remaining) {
            if (totalSize <= retention.maxSizeBytes!) break;

            try {
                await unlink(file.path);
                totalSize -= file.size;
                removed++;
            } catch {
                // Another process may have removed the file.
            }
        }
    }

    return removed;
}

export function startFederationInboxCleanup(
    config: ServerConfig,
    onError: (error: unknown) => void,
): () => void {
    const retention = config.federation!.inbox!.retention!;

    if (!retention.enabled) return () => {};

    let running = false;

    const run = async () => {
        if (running) return;
        running = true;

        try {
            await cleanupFederationInbox(config);
        } catch (error) {
            onError(error);
        } finally {
            running = false;
        }
    };

    void run();

    const timer = setInterval(() => {
        void run();
    }, retention.intervalMs);

    timer.unref();

    return () => clearInterval(timer);
}
