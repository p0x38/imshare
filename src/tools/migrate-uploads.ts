import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { env } from "../lib/env.js";
import { loadConfig } from "../lib/config.js";

interface Options {
    apply: boolean;
    deleteLegacy: boolean;
    verifyOnly: boolean;
}

function parseOptions(argv: string[]): Options {
    const options: Options = {
        apply: false,
        deleteLegacy: false,
        verifyOnly: false,
    };

    for (const arg of argv) {
        if (arg === "--apply") options.apply = true;
        else if (arg === "--delete-legacy") options.deleteLegacy = true;
        else if (arg === "--verify") options.verifyOnly = true;
        else if (arg === "--help" || arg === "-h") {
            console.log(
                [
                    "Usage: pnpm migrate:uploads [--apply] [--delete-legacy] [--verify]",
                    "",
                    "Without --apply, the migration is a dry run.",
                    "--apply          Move files and update database records.",
                    "--delete-legacy  Remove old flat files after a successful migration.",
                    "--verify         Verify existing sharded upload files only.",
                ].join("\n"),
            );
            return;
        } else {
            throw new Error("Unknown option: " + arg);
        }
    }

    if (options.deleteLegacy && !options.apply)
        throw new Error("--delete-legacy requires --apply.");

    if (options.verifyOnly && options.apply)
        throw new Error("--verify cannot be combined with --apply.");

    return options;
}

function targetFilename(contentHash: string, extension: string): string {
    return path.posix.join(
        contentHash.slice(0, 2),
        contentHash.slice(0, 4),
        contentHash + extension,
    );
}

function isLegacyFilename(filename: string): boolean {
    return !filename.includes("/") && !filename.includes("\\");
}

async function sha256File(filePath: string): Promise<string> {
    const bytes = await readFile(filePath);
    return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const config = await loadConfig();
    const uploadDir = path.resolve(process.cwd(), config.storage.uploadDirectory);

    const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
    const prisma = new PrismaClient({ adapter });

    try {
        const uploads = await prisma.upload.findMany({
            select: {
                id: true,
                filename: true,
                contentHash: true,
            },
            orderBy: { createdAt: "asc" },
        });

        if (options.verifyOnly) {
            let checked = 0;
            let missing = 0;
            let mismatched = 0;

            for (const upload of uploads) {
                if (!upload.contentHash || isLegacyFilename(upload.filename)) continue;

                checked++;
                const source = path.resolve(uploadDir, upload.filename);
                const relative = path.relative(uploadDir, source);
                if (relative.startsWith("..") || path.isAbsolute(relative)) {
                    mismatched++;
                    console.error("UNSAFE " + upload.id + ": " + upload.filename);
                    continue;
                }

                try {
                    const actualHash = await sha256File(source);
                    if (actualHash !== upload.contentHash) {
                        mismatched++;
                        console.error(
                            "MISMATCH " +
                                upload.id +
                                ": database=" +
                                upload.contentHash +
                                " file=" +
                                actualHash,
                        );
                    }
                } catch {
                    missing++;
                    console.error("MISSING " + upload.id + ": " + upload.filename);
                }
            }

            console.log(
                "Verified " +
                    checked +
                    " sharded upload(s): " +
                    mismatched +
                    " mismatched, " +
                    missing +
                    " missing.",
            );
            if (mismatched || missing) process.exitCode = 1;
            return;
        }

        const legacy = uploads.filter((upload) => isLegacyFilename(upload.filename));
        console.log(
            "Found " +
                legacy.length +
                " legacy flat upload(s) out of " +
                uploads.length +
                " total upload(s).",
        );

        let migrated = 0;
        let missing = 0;
        let conflicts = 0;

        for (const upload of legacy) {
            const source = path.resolve(uploadDir, upload.filename);
            const sourceRelative = path.relative(uploadDir, source);
            if (sourceRelative.startsWith("..") || path.isAbsolute(sourceRelative)) {
                conflicts++;
                console.error("UNSAFE " + upload.id + ": " + upload.filename);
                continue;
            }

            try {
                await access(source);
            } catch {
                missing++;
                console.error("MISSING " + upload.id + ": " + upload.filename);
                continue;
            }

            const actualHash = await sha256File(source);
            const extension = path.extname(upload.filename).toLowerCase();
            const destinationFilename = targetFilename(actualHash, extension);
            const destination = path.resolve(uploadDir, destinationFilename);
            const destinationRelative = path.relative(uploadDir, destination);

            if (
                destinationRelative.startsWith("..") ||
                path.isAbsolute(destinationRelative) ||
                !destinationFilename.startsWith(actualHash.slice(0, 4))
            ) {
                conflicts++;
                console.error("UNSAFE " + upload.id + ": " + destinationFilename);
                continue;
            }

            console.log(
                (options.apply ? "MIGRATE " : "WOULD MIGRATE ") +
                    upload.filename +
                    " -> " +
                    destinationFilename,
            );

            if (!options.apply) continue;

            await mkdir(path.dirname(destination), { recursive: true });

            let destinationExists = true;
            try {
                await access(destination);
            } catch {
                destinationExists = false;
            }

            if (destinationExists) {
                const destinationHash = await sha256File(destination);
                if (destinationHash !== actualHash) {
                    conflicts++;
                    console.error(
                        "CONFLICT " +
                            upload.id +
                            ": destination exists with hash " +
                            destinationHash,
                    );
                    continue;
                }

                await unlink(source);
            } else {
                await rename(source, destination);
            }

            await prisma.upload.update({
                where: { id: upload.id },
                data: {
                    filename: destinationFilename,
                    contentHash: actualHash,
                },
            });

            if (options.deleteLegacy && !destinationExists) {
                await unlink(source).catch(() => undefined);
            }

            migrated++;
        }

        console.log(
            (options.apply ? "Migrated " : "Planned ") +
                (options.apply ? migrated : legacy.length) +
                " upload(s)." +
                (missing ? " " + missing + " missing file(s) need attention." : "") +
                (conflicts ? " " + conflicts + " conflict(s) need attention." : ""),
        );

        if (missing || conflicts) process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

await main();
