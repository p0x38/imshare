import path from "node:path";
import { loadConfigSync } from "../src/lib/config.js";
import { resolveStorageDirectory } from "../src/lib/storage-directories.js";
import { migrateStorageDirectory } from "../src/lib/storage-migration.js";

interface MigrationTask {
    name: string;
    source: string;
    destination: string;
}

async function main(): Promise<void> {
    const config = loadConfigSync();

    const dataDirectory = path.resolve("data");

    const tasks: MigrationTask[] = [
        {
            name: "Uploads",
            source: path.resolve("uploads"),
            destination: resolveStorageDirectory(config, "uploads"),
        },
        {
            name: "Avatars",
            source: path.join(dataDirectory, "avatars"),
            destination: resolveStorageDirectory(config, "avatars"),
        },
    ];

    let hasFailures = false;

    for (const task of tasks) {
        console.log(`\nMigrating ${task.name}`);
        console.log(`  Source:      ${task.source}`);
        console.log(`  Destination: ${task.destination}`);

        try {
            const result = await migrateStorageDirectory(task.source, task.destination);

            console.log(`  Copied:  ${result.copied}`);
            console.log(`  Skipped: ${result.skipped}`);
            console.log(`  Failed:  ${result.failed}`);

            if (result.failed > 0) {
                hasFailures = true;
            }
        } catch (error) {
            hasFailures = true;

            console.error(
                `  Migration failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    if (hasFailures) {
        process.exitCode = 1;
        return;
    }

    console.log("\nStorage migration completed.");
}

main().catch((error: unknown) => {
    console.error("Storage migration failed:", error);
    process.exitCode = 1;
});
