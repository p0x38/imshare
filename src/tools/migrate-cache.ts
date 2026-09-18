import { access, mkdir, readdir, rename, stat, rmdir } from "node:fs/promises";
import path from "node:path";

async function main(): Promise<void> {
    const source = path.resolve(process.cwd(), "uploads", ".cache");
    const destination = path.resolve(process.cwd(), "cache");

    try {
        await access(source);
    } catch {
        console.log("No legacy uploads/.cache directory found.");
        return;
    }

    await mkdir(destination, { recursive: true });

    const entries = await readdir(source, { withFileTypes: true });
    let moved = 0;
    let skipped = 0;

    for (const entry of entries) {
        const from = path.join(source, entry.name);
        const to = path.join(destination, entry.name);

        try {
            await access(to);
            skipped++;
            console.log("SKIP existing cache entry: " + entry.name);
            continue;
        } catch {}

        await rename(from, to);
        moved++;
    }

    try {
        const remaining = await readdir(source);
        if (!remaining.length) await rmdir(source);
    } catch {}

    console.log("Moved " + moved + " cache entr" + (moved === 1 ? "y" : "ies") + ".");
    if (skipped)
        console.log("Skipped " + skipped + " existing entr" + (skipped === 1 ? "y." : "ies."));
}

await main();
