import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export function resolveCacheDirectory(): string {
    return path.resolve(process.cwd(), "cache");
}

export async function ensureCacheDirectory(): Promise<string> {
    const directory = resolveCacheDirectory();
    await mkdir(directory, { recursive: true });
    return directory;
}

/**
 * Resolve a cache key to the same two-level hash layout used by upload storage.
 *
 * The hash is derived from the logical cache key, not from the generated file
 * contents, so the same transformation request always maps to the same path.
 */
export function hashCacheKey(key: string): string {
    return createHash("sha256").update(key, "utf8").digest("hex");
}

export function resolveCachePath(cacheDirectory: string, key: string): string {
    const hash = hashCacheKey(key);
    const extension = path.extname(key);
    return path.join(
        cacheDirectory,
        hash.slice(0, 2),
        hash.slice(0, 4),
        `${hash}${extension}`,
    );
}

export function resolveCacheRelativePath(key: string): string {
    const hash = hashCacheKey(key);
    const extension = path.extname(key);
    return path.posix.join(hash.slice(0, 2), hash.slice(0, 4), `${hash}${extension}`);
}
