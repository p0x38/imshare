import { access, copyFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { env } from "../lib/env.js";
import { loadConfig } from "../lib/config.js";
import { uploadStorageDirectory } from "../lib/upload-storage.js";

interface Options {
    apply: boolean;
    deleteLegacy: boolean;
}

function parseOptions(argv: string[]): Options {
    let apply = false;
    let deleteLegacy = false;

    for (const arg of argv) {
        if (arg === "--apply") apply = true;
        else if (arg === "--delete-legacy") deleteLegacy = true;
        else if (arg === "--help" || arg === "-h") {
            console.log(
                [
                    "Usage: pnpm migrate:avatars [options]",
                    "",
                    "Without --apply, the migration is a dry run.",
                    "--apply          Move existing custom avatar files into the avatar directory.",
                    "--delete-legacy  Remove the original upload-area file after a verified move.",
                    "--help           Show this help.",
                ].join("\n"),
            );
            process.exit(0);
        } else {
            throw new Error("Unknown option: " + arg);
        }
    }

    if (deleteLegacy && !apply)
        throw new Error("--delete-legacy requires --apply.");

    return { apply, deleteLegacy };
}

function resolveSafe(root: string, filename: string): string {
    const normalized = filename.replaceAll("\\", "/");
    const target = path.resolve(root, normalized);
    const relative = path.relative(root, target);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
        throw new Error("Path escapes storage directory: " + filename);
    return target;
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const config = await loadConfig();
    const uploadDirectory = uploadStorageDirectory(config, "uploads");
    const avatarDirectory = uploadStorageDirectory(config, "avatars");

    await mkdir(avatarDirectory, { recursive: true });

    const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
    const prisma = new PrismaClient({ adapter });

    try {
        const avatars = await prisma.user.findMany({
            where: {
                avatarMode: "custom",
                avatarValue: { not: null },
            },
            select: {
                id: true,
                avatarValue: true,
            },
            orderBy: { id: "asc" },
        });

        let migrated = 0;
        let skipped = 0;
        let missing = 0;
        let invalid = 0;

        for (const user of avatars) {
            const value = user.avatarValue?.trim();
            if (!value || /^https?:\/\//i.test(value)) {
                skipped++;
                continue;
            }

            const upload = await prisma.upload.findUnique({
                where: { id: value },
                select: {
                    id: true,
                    filename: true,
                    storageArea: true,
                },
            });

            if (!upload) {
                invalid++;
                console.error("MISSING DB UPLOAD " + user.id + ": " + value);
                continue;
            }

            if (upload.storageArea === "avatars") {
                skipped++;
                continue;
            }

            if (upload.storageArea !== "uploads") {
                invalid++;
                console.error(
                    "UNSUPPORTED STORAGE AREA " +
                        upload.id +
                        ": " +
                        String(upload.storageArea),
                );
                continue;
            }

            const source = resolveSafe(uploadDirectory, upload.filename);
            const destination = resolveSafe(avatarDirectory, upload.filename);

            try {
                await access(source);
            } catch {
                missing++;
                console.error("MISSING FILE " + upload.id + ": " + upload.filename);
                continue;
            }

            console.log(
                (options.apply ? "MIGRATE " : "WOULD MIGRATE ") +
                    upload.id +
                    " (" +
                    user.id +
                    ") " +
                    upload.filename +
                    " -> " +
                    path.relative(process.cwd(), destination),
            );

            if (!options.apply) continue;

            await mkdir(path.dirname(destination), { recursive: true });

            try {
                await access(destination);
            } catch {
                await copyFile(source, destination);
            }

            await prisma.upload.update({
                where: { id: upload.id },
                data: { storageArea: "avatars" },
            });

            if (options.deleteLegacy) {
                await unlink(source).catch(() => undefined);
            }

            migrated++;
        }

        console.log(
            (options.apply ? "Migrated " : "Planned ") +
                migrated +
                " avatar upload(s)." +
                (skipped ? " " + skipped + " already current/external avatar(s) skipped." : "") +
                (missing ? " " + missing + " missing file(s) need attention." : "") +
                (invalid ? " " + invalid + " invalid reference(s) need attention." : ""),
        );

        if (missing || invalid) process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

await main();
