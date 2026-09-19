import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import { loadConfigSync } from "./config.js";
import { observability } from "../instrumentation.js";

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

export function resolveCacheDirectory(config?: ServerConfig): string {
    const storage = config?.storage ?? loadConfigSync().storage;
    const dataDirectory = path.resolve(process.cwd(), storage.dataDirectory ?? "data");
    return path.join(dataDirectory, "cache");
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
    if (!useHashedDirectory) return path.join(cacheDirectory, key);
    const hash = hashCacheKey(key);
    const extension = path.extname(key);
    return path.join(cacheDirectory, hash.slice(0, 2), hash.slice(0, 4), `${hash}${extension}`);
}

export async function readCacheFile(
    filePath: string,
    ttl: number,
    now = Date.now(),
): Promise<Buffer | undefined> {
    try {
        const information = await stat(filePath);
        if (now - information.mtimeMs > ttl) {
            await unlink(filePath);
            observability.recordCacheStale("file");
            observability.recordCacheMiss("file");
            return undefined;
        }
        const data = await readFile(filePath);
        observability.recordCacheHit("file");
        return data;
    } catch {
        observability.recordCacheMiss("file");
        return undefined;
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
            try { await rmdir(entryPath); } catch {}
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
    if (removed > 0) observability.recordCachePruned(removed);
    return removed;
}
