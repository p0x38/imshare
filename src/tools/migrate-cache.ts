import { createHash } from "node:crypto";
import { access, mkdir, readdir, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { getCacheSettings, resolveCacheDirectory, resolveCachePath } from "../lib/cache.js";

function hashKey(key: string): string {
    return createHash("sha256").update(key, "utf8").digest("hex");
}

function hashedDestination(root: string, key: string): string {
    const hash = hashKey(key);
    const extension = path.extname(key);
    return path.join(root, hash.slice(0, 2), hash.slice(0, 4), `${hash}${extension}`);
}

async function migrateDirectory(
    source: string,
    destination: string,
): Promise<{ moved: number; skipped: number }> {
    let entries;
    try {
        entries = await readdir(source, { withFileTypes: true });
    } catch {
        return { moved: 0, skipped: 0 };
    }

    let moved = 0;
    let skipped = 0;

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const from = path.join(source, entry.name);
        const to = resolveCachePath(destination, entry.name, useHashedDirectory);
        await mkdir(path.dirname(to), { recursive: true });

        try {
            await access(to);
            skipped++;
            console.log("SKIP existing cache entry: " + entry.name);
            continue;
        } catch {}

        await rename(from, to);
        moved++;
    }

    return { moved, skipped };
}

async function main(): Promise<void> {
    const config = await loadConfig();
    const settings = getCacheSettings(config);
    const legacySource = path.resolve(process.cwd(), "uploads", ".cache");
    const cacheDirectory = resolveCacheDirectory(config);

    await mkdir(cacheDirectory, { recursive: true });

    const sources = [legacySource, cacheDirectory];
    let moved = 0;
    let skipped = 0;

    for (const source of sources) {
        try {
            await access(source);
        } catch {
            if (source === legacySource)
                console.log("No legacy uploads/.cache directory found.");
            continue;
        }

        const result = await migrateDirectory(source, cacheDirectory, settings.useHashedDirectory);
        moved += result.moved;
        skipped += result.skipped;

        if (source === legacySource) {
            try {
                const remaining = await readdir(source);
                if (!remaining.length) await rmdir(source);
            } catch {}
        }
    }

    console.log("Migrated " + moved + " cache entr" + (moved === 1 ? "y." : "ies."));
    if (skipped)
        console.log("Skipped " + skipped + " existing entr" + (skipped === 1 ? "y." : "ies."));
}

await main();
