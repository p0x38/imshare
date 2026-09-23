import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { env } from "../lib/env.js";
import { loadConfig } from "../lib/config.js";
import { generateThumbHash } from "../lib/thumbnails.js";
import sharp from "sharp";

interface Options {
    apply: boolean;
    deleteLegacy: boolean;
    verifyOnly: boolean;
    audit: boolean;
    importOrphanHash?: string;
    importOrphanUserId?: string;
}

function parseOptions(argv: string[]): Options {
    const options: Options = {
        apply: false,
        deleteLegacy: false,
        verifyOnly: false,
        audit: false,
    };

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];

        if (arg === "--apply") options.apply = true;
        else if (arg === "--delete-legacy") options.deleteLegacy = true;
        else if (arg === "--verify") options.verifyOnly = true;
        else if (arg === "--audit") options.audit = true;
        else if (arg === "--import-orphan") {
            const value = argv[++index];
            if (!value) throw new Error("--import-orphan requires a SHA-256 hash.");
            if (!/^[a-f0-9]{64}$/i.test(value))
                throw new Error("--import-orphan requires a 64-character SHA-256 hash.");
            options.importOrphanHash = value.toLowerCase();
        } else if (arg === "--user") {
            const value = argv[++index];
            if (!value) throw new Error("--user requires a user ID.");
            options.importOrphanUserId = value;
        } else if (arg === "--help" || arg === "-h") {
            console.log(
                [
                    "Usage: pnpm migrate:uploads [options]",
                    "",
                    "Without --apply, migrations and imports are dry runs.",
                    "--apply                         Apply filesystem and database changes.",
                    "--delete-legacy                Remove old flat files after a successful migration.",
                    "--verify                       Verify existing sharded upload files only.",
                    "--audit                        Scan upload files and reconcile them with the database.",
                    "--import-orphan <sha256> --user <id>",
                    "                                Adopt an unreferenced image into the database.",
                    "--help                         Show this help.",
                ].join("\n"),
            );
            process.exit(0);
        } else {
            throw new Error("Unknown option: " + arg);
        }
    }

    if (options.deleteLegacy && !options.apply)
        throw new Error("--delete-legacy requires --apply.");

    if (options.verifyOnly && options.apply)
        throw new Error("--verify cannot be combined with --apply.");

    if (options.audit && (options.apply || options.verifyOnly))
        throw new Error("--audit cannot be combined with --apply or --verify.");

    if (
        options.importOrphanHash &&
        (!options.importOrphanUserId || options.audit || options.verifyOnly)
    )
        throw new Error(
            "--import-orphan requires --user and cannot be combined with --audit or --verify.",
        );

    if (options.importOrphanUserId && !options.importOrphanHash)
        throw new Error("--user can only be used with --import-orphan.");

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

function resolveUploadPath(uploadDir: string, filename: string): string {
    const normalized = filename.replaceAll("\\\\", "/");
    const target = path.resolve(uploadDir, normalized);
    const relative = path.relative(uploadDir, target);

    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
        throw new Error("Path escapes upload directory: " + filename);
    }

    return target;
}

async function collectFiles(root: string, relative = ""): Promise<string[]> {
    const directory = path.join(root, relative);
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        if (entry.name === ".cache") continue;
        const child = path.posix.join(relative.replaceAll("\\\\", "/"), entry.name);
        if (entry.isDirectory()) files.push(...(await collectFiles(root, child)));
        else if (entry.isFile()) files.push(child);
    }

    return files;
}

async function sha256File(filePath: string): Promise<string> {
    const bytes = await readFile(filePath);
    return createHash("sha256").update(bytes).digest("hex");
}

async function findFileByHash(uploadDir: string, contentHash: string): Promise<string | undefined> {
    const files = await collectFiles(uploadDir);

    for (const relativeFilename of files) {
        const source = resolveUploadPath(uploadDir, relativeFilename);
        if ((await sha256File(source)) === contentHash) return relativeFilename;
    }

    return undefined;
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const config = await loadConfig();
    const uploadDir = path.resolve(process.cwd(), config.storage.uploadDirectory);
    const legacyUploadDir = path.resolve(process.cwd(), "uploads");
    const sourceDirectories = [
        uploadDir,
        ...(path.resolve(legacyUploadDir) === path.resolve(uploadDir) ? [] : [legacyUploadDir]),
    ];

    const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
    const prisma = new PrismaClient({ adapter });

    try {
        const uploads = await prisma.upload.findMany({
            select: {
                id: true,
                filename: true,
                contentHash: true,
                storageArea: true,
            },
            orderBy: { createdAt: "asc" },
        });

        if (options.importOrphanHash) {
            const contentHash = options.importOrphanHash;
            const userId = options.importOrphanUserId!;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            if (!user) throw new Error("User not found: " + userId);

            const existing = await prisma.upload.findFirst({
                where: { userId, contentHash, storageArea: "uploads" },
                select: { id: true, filename: true },
            });
            if (existing) {
                console.log(
                    "ALREADY REGISTERED " +
                        contentHash +
                        ": upload " +
                        existing.id +
                        " -> " +
                        existing.filename,
                );
                return;
            }

            let sourceDirectory: string | undefined;
            let relativeSource: string | undefined;
            for (const directory of sourceDirectories) {
                relativeSource = await findFileByHash(directory, contentHash);
                if (relativeSource) {
                    sourceDirectory = directory;
                    break;
                }
            }
            if (!relativeSource || !sourceDirectory) {
                throw new Error(
                    "No file with SHA-256 " +
                        contentHash +
                        " was found under " +
                        sourceDirectories.join(" or "),
                );
            }

            const source = resolveUploadPath(sourceDirectory, relativeSource);
            const sourceStats = await stat(source);
            const extension = path.extname(relativeSource).toLowerCase();
            const mimeTypes: Record<string, string> = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".bmp": "image/bmp",
                ".avif": "image/avif",
            };
            const mimeType = mimeTypes[extension];
            if (!mimeType) throw new Error("Unsupported image extension: " + extension);

            const metadata = await sharp(source, { animated: true }).metadata();
            if (!metadata.width || !metadata.height)
                throw new Error("Unable to read image dimensions: " + relativeSource);

            const thumbhash = await generateThumbHash(source);
            const metadataJson = JSON.stringify({
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                channels: metadata.channels,
                depth: metadata.depth,
                space: metadata.space,
                density: metadata.density,
                orientation: metadata.orientation,
                hadExif: Boolean(metadata.exif),
                hadIccProfile: Boolean(metadata.icc),
                isProgressive: metadata.isProgressive,
                pages: metadata.pages,
                pageHeight: metadata.pageHeight,
                loop: metadata.loop,
            });

            const destinationFilename = targetFilename(contentHash, extension);
            const destination = resolveUploadPath(uploadDir, destinationFilename);
            const canonicalPath = path.resolve(uploadDir, destinationFilename);

            console.log(
                (options.apply ? "IMPORT " : "WOULD IMPORT ") +
                    relativeSource +
                    " -> " +
                    destinationFilename +
                    " as user " +
                    userId,
            );

            if (!options.apply) return;

            let destinationExists = true;
            try {
                await access(destination);
            } catch {
                destinationExists = false;
            }

            if (!destinationExists) {
                await mkdir(path.dirname(destination), { recursive: true });
                await copyFile(source, destination);
                if ((await sha256File(destination)) !== contentHash) {
                    await unlink(destination).catch(() => undefined);
                    throw new Error("Copied orphan failed SHA-256 verification.");
                }
            }

            const uploadId = randomUUID();
            try {
                await prisma.upload.create({
                    data: {
                        id: uploadId,
                        filename: destinationFilename,
                        originalName: path.basename(relativeSource),
                        mimeType,
                        size: Number(sourceStats.size),
                        width: metadata.width,
                        height: metadata.height,
                        contentHash,
                        thumbhash,
                        metadataJson,
                        userId,
                        storageArea: "uploads",
                    },
                });
            } catch (error) {
                if (!destinationExists) await unlink(canonicalPath).catch(() => undefined);
                throw error;
            }

            if (relativeSource !== destinationFilename) await unlink(source).catch(() => undefined);

            console.log("IMPORTED " + uploadId + ": " + destinationFilename);
            return;
        }

        if (options.audit) {
            const files = await collectFiles(uploadDir);
            const referenced = new Map(
                uploads.map((upload) => [upload.filename.replaceAll("\\\\", "/"), upload]),
            );
            const byHash = new Map<string, (typeof uploads)[number][]>();

            for (const upload of uploads) {
                if (!upload.contentHash) continue;
                const list = byHash.get(upload.contentHash) ?? [];
                list.push(upload);
                byHash.set(upload.contentHash, list);
            }

            let unreferenced = 0;
            let missing = 0;
            let mismatched = 0;
            let pathMismatches = 0;

            const legacyFiles = await collectFiles(legacyUploadDir).catch(() => []);
            console.log(
                "Auditing " +
                    files.length +
                    " file(s) in the configured upload directory and " +
                    legacyFiles.length +
                    " legacy file(s) against " +
                    referenced.size +
                    " DB upload(s)...",
            );

            const inspectFiles = [
                ...files.map((filename) => ({ directory: uploadDir, filename })),
                ...legacyFiles.map((filename) => ({ directory: legacyUploadDir, filename })),
            ];

            for (const item of inspectFiles) {
                const normalized = item.filename.replaceAll("\\", "/");
                const source = resolveUploadPath(item.directory, normalized);
                const hash = await sha256File(source);
                const upload = referenced.get(normalized);

                if (upload && item.directory === uploadDir) {
                    if (upload.contentHash !== hash) {
                        mismatched++;
                        console.error(
                            "HASH MISMATCH " +
                                upload.id +
                                ": " +
                                normalized +
                                " database=" +
                                String(upload.contentHash) +
                                " file=" +
                                hash,
                        );
                    }

                    const expected = targetFilename(hash, path.extname(normalized).toLowerCase());
                    if (normalized !== expected) {
                        pathMismatches++;
                        console.error(
                            "PATH MISMATCH " +
                                upload.id +
                                ": " +
                                normalized +
                                " expected=" +
                                expected,
                        );
                    }
                } else {
                    const matches = [...referenced.values()].filter(
                        (candidate) => candidate.contentHash === hash,
                    );
                    if (matches.length) {
                        const expected = targetFilename(
                            hash,
                            path.extname(normalized).toLowerCase(),
                        );
                        console.log(
                            (item.directory === legacyUploadDir ? "LEGACY DUPLICATE " : "DUPLICATE FILE ") +
                                normalized +
                                " sha256=" +
                                hash +
                                " canonical=" +
                                expected +
                                " upload(s)=" +
                                matches.map((item) => item.id).join(", "),
                        );
                    } else {
                        unreferenced++;
                        console.error(
                            (item.directory === legacyUploadDir ? "LEGACY UNREFERENCED " : "UNREFERENCED ") +
                                normalized +
                                " sha256=" +
                                hash,
                        );
                    }
                }
            }

            for (const upload of referenced.values()) {
                const filename = upload.filename.replaceAll("\\", "/");
                if (!files.includes(filename)) {
                    missing++;
                    console.error("MISSING " + upload.id + ": " + filename);
                }
            }

            console.log(
                "Audit complete: " +
                    inspectFiles.length +
                    " files, " +
                    referenced.size +
                    " DB uploads; " +
                    unreferenced +
                    " unreferenced, " +
                    missing +
                    " missing, " +
                    mismatched +
                    " hash mismatch(es), " +
                    pathMismatches +
                    " path mismatch(es).",
            );

            if (unreferenced || missing || mismatched || pathMismatches) process.exitCode = 1;
            return;
        }

        if (options.verifyOnly) {
            let checked = 0;
            let missing = 0;
            let mismatched = 0;

            for (const upload of uploads) {
                if (
                    upload.storageArea !== "uploads" ||
                    !upload.contentHash ||
                    isLegacyFilename(upload.filename)
                )
                    continue;

                checked++;
                let source: string | undefined;
                for (const directory of sourceDirectories) {
                    try {
                        const candidate = resolveUploadPath(directory, upload.filename);
                        await access(candidate);
                        source = candidate;
                        break;
                    } catch {}
                }

                if (!source) {
                    missing++;
                    console.error("MISSING " + upload.id + ": " + upload.filename);
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

        const legacy = uploads.filter(
            (upload) => upload.storageArea === "uploads" && isLegacyFilename(upload.filename),
        );
        console.log(
            "Found " +
                legacy.length +
                " legacy flat DB upload(s) out of " +
                uploads.filter((upload) => upload.storageArea === "uploads").length +
                " normal upload(s).",
        );

        let migrated = 0;
        let missing = 0;
        let conflicts = 0;

        for (const upload of legacy) {
            let sourceDirectory: string | undefined;
            let source: string | undefined;

            for (const directory of sourceDirectories) {
                try {
                    const candidate = resolveUploadPath(directory, upload.filename);
                    await access(candidate);
                    sourceDirectory = directory;
                    source = candidate;
                    break;
                } catch {}
            }

            if (!source || !sourceDirectory) {
                missing++;
                console.error("MISSING " + upload.id + ": " + upload.filename);
                continue;
            }

            const actualHash = await sha256File(source);
            const extension = path.extname(upload.filename).toLowerCase();
            const destinationFilename = targetFilename(actualHash, extension);
            const destination = resolveUploadPath(uploadDir, destinationFilename);

            console.log(
                (options.apply ? "MIGRATE " : "WOULD MIGRATE ") +
                    sourceDirectory +
                    path.sep +
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
            } else {
                await copyFile(source, destination);
                const copiedHash = await sha256File(destination);
                if (copiedHash !== actualHash) {
                    await unlink(destination).catch(() => undefined);
                    conflicts++;
                    console.error("CONFLICT " + upload.id + ": copied file failed verification");
                    continue;
                }
            }

            await prisma.upload.update({
                where: { id: upload.id },
                data: {
                    filename: destinationFilename,
                    contentHash: actualHash,
                    storageArea: "uploads",
                },
            });

            if (options.deleteLegacy || !destinationExists || sourceDirectory !== uploadDir) {
                if (sourceDirectory !== uploadDir || upload.filename !== destinationFilename)
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
