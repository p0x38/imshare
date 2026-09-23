import { access, mkdir, readdir, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { getCacheSettings, resolveCacheDirectory, resolveCachePath } from "../lib/cache.js";

async function migrateDirectory(
    source: string,
    destination: string,
    useHashedDirectory: boolean,
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
    const legacySource = path.resolve(process.cwd(), config.storage.uploadDirectory, ".cache");
    const cacheDirectory = resolveCacheDirectory(config);

    await mkdir(cacheDirectory, { recursive: true });

    for (const source of [legacySource, path.resolve(process.cwd(), "cache")]) {
        if (path.resolve(source) === path.resolve(cacheDirectory)) continue;

        try {
            await access(source);
        } catch {
            continue;
        }

        const result = await migrateDirectory(source, cacheDirectory, settings.useHashedDirectory);
        console.log(`Migrated ${result.moved} cache entr${result.moved === 1 ? "y" : "ies"} from ${source}`);
        if (result.skipped)
            console.log(`Skipped ${result.skipped} existing entr${result.skipped === 1 ? "y" : "ies"}`);

        try {
            if (!(await readdir(source)).length) await rmdir(source);
        } catch {}
    }
}

await main();
