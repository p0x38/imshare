import { createHash } from "node:crypto";
import { mkdir, open as openFile, readdir, stat, unlink, rmdir } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import type { ServerConfig } from "./config.js";
import { loadConfigSync } from "./config.js";
import { observability } from "../instrumentation.js";
import { resolveCacheDirectory } from "./storage-directories.js";
import path from "node:path";

export { resolveCacheDirectory };

const DEFAULT_TTL = 30 * 86_400_000;

export interface CacheSettings {
    ttl: number;
    useHashedDirectory: boolean;
}

export function getCacheSettings(config?: ServerConfig): CacheSettings {
    const settings = config?.storage.cache ?? loadConfigSync().storage.cache;
    return {
        ttl: settings?.ttl ?? DEFAULT_TTL,
        useHashedDirectory: settings?.useHashedDirectory ?? true,
    };
}

export async function ensureCacheDirectory(config?: ServerConfig): Promise<string> {
    const directory = resolveCacheDirectory(config);
    await mkdir(directory, { recursive: true });
    return directory;
}

export function hashCacheKey(key: string): string {
    return createHash("sha256").update(key, "utf8").digest("hex");
}

export function resolveCachePath(
    cacheDirectory: string,
    key: string,
    useHashedDirectory = true,
): string {
    const root = path.resolve(cacheDirectory);

    if (!useHashedDirectory) {
        const target = path.resolve(root, key);
        const relative = path.relative(root, target);

        if (
            !relative ||
            relative === ".." ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative)
        )
            throw new Error("Cache key escapes the cache directory.");

        return target;
    }

    const hash = hashCacheKey(key);
    const extension = path.extname(key);
    return path.join(root, hash.slice(0, 2), hash.slice(0, 4), `${hash}${extension}`);
}

export async function readCacheFile(
    filePath: string,
    ttl: number,
    now = Date.now(),
): Promise<Buffer | undefined> {
    let handle: FileHandle | undefined;

    try {
        handle = await openFile(filePath, "r");
        const information = await handle.stat();

        if (now - information.mtimeMs > ttl) {
            await handle.close();
            handle = undefined;

            await unlink(filePath).catch(() => undefined);

            observability.recordCacheStale("file");
            observability.recordCacheMiss("file");
            return undefined;
        }

        const data = await handle.readFile();
        observability.recordCacheHit("file");
        return data;
    } catch {
        observability.recordCacheMiss("file");
        return undefined;
    } finally {
        if (handle) {
            await handle.close().catch(() => undefined);
        }
    }
}

export function cacheMaxAgeSeconds(ttl: number): number {
    return Math.max(0, Math.floor(ttl / 1000));
}

export async function pruneCacheDirectory(
    cacheDirectory: string,
    ttl: number,
    now = Date.now(),
): Promise<number> {
    let removed = 0;
    let entries;
    try {
        entries = await readdir(cacheDirectory, { withFileTypes: true });
    } catch {
        return 0;
    }
    for (const entry of entries) {
        const entryPath = path.join(cacheDirectory, entry.name);
        if (entry.isDirectory()) {
            removed += await pruneCacheDirectory(entryPath, ttl, now);
            try {
                await rmdir(entryPath);
            } catch {}
            continue;
        }
        if (!entry.isFile()) continue;
        try {
            const information = await stat(entryPath);
            if (now - information.mtimeMs > ttl) {
                await unlink(entryPath);
                removed++;
            }
        } catch {}
    }
    return removed;
}
