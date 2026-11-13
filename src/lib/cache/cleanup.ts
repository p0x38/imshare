import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import type { ServerConfig } from "../config.js";
import { resolveCacheDirectory, pruneCacheDirectory } from "../cache.js";

interface CacheFile {
    path: string;
    size: number;
    modifiedAt: number;
}

const DEFAULT_TTL = 30 * 86_400_000;
const DEFAULT_INTERVAL = 3_600_000;
const DEFAULT_MAX_SIZE = 5 * 1024 ** 3;

function isMissingFile(error: unknown): boolean {
    return (
        typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
    );
}

async function collectCacheFiles(directory: string): Promise<CacheFile[]> {
    const files: CacheFile[] = [];

    let entries;

    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (isMissingFile(error)) return files;
        throw error;
    }

    for (const entry of entries) {
        const filePath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...(await collectCacheFiles(filePath)));
            continue;
        }

        if (!entry.isFile()) continue;

        try {
            const information = await stat(filePath);

            if (!information.isFile()) continue;

            files.push({
                path: filePath,
                size: information.size,
                modifiedAt: information.mtimeMs,
            });
        } catch (error) {
            if (isMissingFile(error)) continue;
            throw error;
        }
    }

    return files;
}

export async function cleanupCache(config: ServerConfig): Promise<number> {
    const settings = config.storage.cache?.cleanup;

    if (settings?.enabled === false) return 0;

    const directory = resolveCacheDirectory(config);
    const ttl = config.storage.cache?.ttl ?? DEFAULT_TTL;
    const maxSizeBytes = settings?.maxSizeBytes ?? DEFAULT_MAX_SIZE;

    let removed = await pruneCacheDirectory(directory, ttl);

    const files = await collectCacheFiles(directory);
    let totalSize = files.reduce((total, file) => total + file.size, 0);

    files.sort((a, b) => a.modifiedAt - b.modifiedAt);

    for (const file of files) {
        if (totalSize <= maxSizeBytes) break;

        try {
            await unlink(file.path);
            totalSize -= file.size;
            removed++;
        } catch (error) {
            if (!isMissingFile(error)) throw error;
        }
    }

    return removed;
}

export function startCacheCleanup(
    config: ServerConfig,
    onError: (error: unknown) => void,
): () => void {
    const settings = config.storage.cache?.cleanup!;

    if (!settings.enabled) return () => {};

    const intervalMs = settings?.intervalMs ?? DEFAULT_INTERVAL;

    let running = false;

    const run = async (): Promise<void> => {
        if (running) return;

        running = true;

        try {
            await cleanupCache(config);
        } catch (error) {
            onError(error);
        } finally {
            running = false;
        }
    };

    void run();

    const timer = setInterval(() => {
        void run();
    }, intervalMs);

    timer.unref();

    return () => clearInterval(timer);
}
