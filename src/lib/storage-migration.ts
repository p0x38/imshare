import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface StorageMigrationResult {
    copied: number;
    skipped: number;
    failed: number;
}

async function copyDirectory(
    source: string,
    destination: string,
    result: StorageMigrationResult,
): Promise<void> {
    const entries = await readdir(source, { withFileTypes: true });

    await mkdir(destination, { recursive: true });

    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, destinationPath, result);
            continue;
        }

        if (!entry.isFile()) {
            result.skipped++;
            continue;
        }

        try {
            await stat(destinationPath);
            result.skipped++;
            continue;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                result.failed++;
                continue;
            }
        }

        try {
            await copyFile(sourcePath, destinationPath);
            result.copied++;
        } catch {
            result.failed++;
        }
    }
}

export async function migrateStorageDirectory(
    source: string,
    destination: string,
): Promise<StorageMigrationResult> {
    const resolvedSource = path.resolve(source);
    const resolvedDestination = path.resolve(destination);

    if (
        resolvedSource === resolvedDestination ||
        resolvedDestination.startsWith(`${resolvedSource}${path.sep}`)
    ) {
        throw new Error("Migration destination cannot be inside the source directory.");
    }

    const result: StorageMigrationResult = {
        copied: 0,
        skipped: 0,
        failed: 0,
    };

    try {
        await stat(resolvedSource);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return result;
        }

        throw error;
    }

    await copyDirectory(resolvedSource, resolvedDestination, result);

    return result;
}
