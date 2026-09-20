import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { env } from "../lib/env.js";
import { loadConfig } from "../lib/config.js";
import { generateThumbHash } from "../lib/thumbnails.js";
import { permalinkBase, type PermalinkIdType } from "../lib/post-permalink.js";
import {
    GIF_SHARP_PIXEL_LIMIT,
    validateGifMetadata,
} from "../lib/gif-security.js";

const IMAGE_EXTENSIONS = new Map<string, string>([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/gif", ".gif"],
    ["image/webp", ".webp"],
    ["image/bmp", ".bmp"],
    ["image/avif", ".avif"],
]);

interface Options {
    user: string;
    files: string[];
    directory?: string;
    recursive: boolean;
    apply: boolean;
    deleteSource: boolean;
    check: boolean;
}

interface PreparedImage {
    source: string;
    originalName: string;
    normalized: Buffer;
    contentHash: string;
    mimeType: string;
    extension: string;
    width: number;
    height: number;
    metadataJson: string;
}

function parseOptions(argv: string[]): Options {
    let user = "";
    let directory: string | undefined;
    const files: string[] = [];
    let recursive = false;
    let apply = false;
    let deleteSource = false;
    let check = false;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined) continue;

        if (arg === "--user" || arg === "-u") user = argv[++index] ?? "";
        else if (arg === "--file" || arg === "-f") {
            const value = argv[++index];
            if (!value) throw new Error("--file requires a path.");
            files.push(value);
        } else if (arg === "--directory" || arg === "-d") {
            directory = argv[++index];
            if (!directory) throw new Error("--directory requires a path.");
        } else if (arg === "--recursive" || arg === "-r") recursive = true;
        else if (arg === "--apply") apply = true;
        else if (arg === "--delete-source") deleteSource = true;
        else if (arg === "--check") check = true;
        else if (arg === "--help" || arg === "-h") {
            console.log(
                [
                    "Usage:",
                    "  pnpm import:draft-images --user <id-or-handle> --apply --file <image> [--file <image> ...]",
                    "  pnpm import:draft-images --user <id-or-handle> --apply --directory <directory> [--recursive]",
                    "",
                    "Creates one private draft image post per imported image.",
                    "The browser upload endpoint and its HTTP rate limits are not used.",
                    "",
                    "--user <id-or-handle>    imshare user that owns the imported post(s).",
                    "--file <path>            Import one image. Repeat for multiple files.",
                    "--directory <path>       Import supported images from a directory.",
                    "--recursive              Recurse into subdirectories.",
                    "--apply                  Actually write files and database records after preflight validation.",
                    "--delete-source          Delete source images after successful import.",
                    "--check                  Validate all candidate images and database state without writing anything.",
                    "--help                   Show this help.",
                ].join("\n"),
            );
            process.exit(0);
        } else if (arg.startsWith("-")) {
            throw new Error("Unknown option: " + arg);
        } else {
            files.push(arg);
        }
    }

    if (!user) throw new Error("--user is required.");
    if (!files.length && !directory) throw new Error("Provide at least one --file or --directory.");
    if (files.length && directory) throw new Error("--file and --directory cannot be combined.");
    if (deleteSource && !apply) throw new Error("--delete-source requires --apply.");
    if (check && apply) throw new Error("--check cannot be combined with --apply.");

    return { user, files, directory, recursive, apply, deleteSource, check };
}

function resolveUser(prisma: PrismaClient, value: string) {
    return prisma.user.findFirst({
        where: {
            OR: [{ id: value }, { handle: value }],
        },
        select: { id: true, handle: true },
    });
}

async function collectDirectoryFiles(directory: string, recursive: boolean): Promise<string[]> {
    const entries = await (await import("node:fs/promises")).readdir(directory, {
        withFileTypes: true,
    });
    const files: string[] = [];

    for (const entry of entries) {
        const source = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            if (recursive) files.push(...(await collectDirectoryFiles(source, recursive)));
            continue;
        }

        if (entry.isFile()) files.push(source);
    }

    return files;
}

function isSupportedSource(source: string): boolean {
    return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif"].includes(
        path.extname(source).toLowerCase(),
    );
}

async function prepareImage(source: string): Promise<PreparedImage> {
    const original = await sharp(source).metadata();

    if (!original.width || !original.height)
        throw new Error("Unable to read image dimensions.");

    const isGif = original.format === "gif";
    if (isGif) validateGifMetadata(original);

    const sharpOptions = {
        animated: true,
        ...(isGif ? { limitInputPixels: GIF_SHARP_PIXEL_LIMIT } : {}),
    };

    const normalized = await sharp(source, sharpOptions)
        .rotate()
        .toColorspace("srgb")
        .toBuffer();
    const metadata = await sharp(normalized, sharpOptions).metadata();
    const mimeType = metadata.mediaType;
    const extension = mimeType ? IMAGE_EXTENSIONS.get(mimeType) : undefined;

    if (!mimeType || !extension)
        throw new Error(
            "Unsupported detected image format: " + (mimeType ?? original.format ?? "unknown"),
        );
    if (!metadata.width || !metadata.height)
        throw new Error("Unable to read normalized image dimensions.");

    return {
        source,
        originalName: path.basename(source),
        normalized,
        contentHash: createHash("sha256").update(normalized).digest("hex"),
        mimeType,
        extension,
        width: metadata.width,
        height: metadata.height,
        metadataJson: JSON.stringify({
            format: original.format,
            normalizedFormat: metadata.format,
            width: metadata.width,
            height: metadata.height,
            channels: original.channels,
            depth: original.depth,
            space: original.space,
            density: original.density,
            orientation: original.orientation,
            hadExif: Boolean(original.exif),
            hadIccProfile: Boolean(original.icc),
            isProgressive: original.isProgressive,
            pages: original.pages,
            pageHeight: original.pageHeight,
            loop: original.loop,
            importer: "import-draft-images",
        }),
    };
}

async function preflight(
    prisma: PrismaClient,
    userId: string,
    sourceFiles: string[],
): Promise<{ source: string; image: PreparedImage }[]> {
    const prepared: { source: string; image: PreparedImage }[] = [];
    const errors: string[] = [];

    for (const source of sourceFiles) {
        try {
            const sourceStats = await stat(source);
            if (!sourceStats.isFile()) {
                errors.push(source + ": not a file.");
                continue;
            }

            const image = await prepareImage(source);
            const existing = await prisma.upload.findUnique({
                where: {
                    userId_contentHash: {
                        userId,
                        contentHash: image.contentHash,
                    },
                },
                select: { id: true, postId: true },
            });

            if (existing?.postId) {
                console.log(
                    "CHECK " +
                        image.originalName +
                        ": already attached to post " +
                        existing.postId +
                        ".",
                );
                continue;
            }

            console.log(
                "CHECK " +
                    image.originalName +
                    ": " +
                    image.mimeType +
                    " " +
                    image.width +
                    "x" +
                    image.height +
                    " OK.",
            );
            prepared.push({ source, image });
        } catch (error) {
            errors.push(
                source +
                    ": " +
                    (error instanceof Error ? error.message : String(error)),
            );
        }
    }

    if (errors.length > 0) {
        throw new Error(
            "Preflight check failed with " +
                errors.length +
                " error(s):\n" +
                errors.map((error) => "  - " + error).join("\n"),
        );
    }

    console.log(
        "Preflight check passed: " +
            prepared.length +
            " image(s) are ready to import.",
    );
    return prepared;
}

async function targetFilename(uploadDirectory: string, image: PreparedImage): Promise<string> {
    const filename = image.contentHash + image.extension;
    return path.join(
        uploadDirectory,
        image.contentHash.slice(0, 2),
        image.contentHash.slice(0, 4),
        filename,
    );
}

async function createDraft(
    prisma: PrismaClient,
    uploadDirectory: string,
    userId: string,
    image: PreparedImage,
): Promise<{ postId: string; uploadId: string; reused: boolean }> {
    const existing = await prisma.upload.findUnique({
        where: {
            userId_contentHash: {
                userId,
                contentHash: image.contentHash,
            },
        },
        select: { id: true, postId: true },
    });

    if (existing?.postId) {
        throw new Error(
            `The image is already attached to post ${existing.postId} for this user.`,
        );
    }

    let uploadId = existing?.id;
    let reused = Boolean(existing);
    let destination: string | undefined;
    let createdDestination = false;

    if (!uploadId) {
        destination = await targetFilename(uploadDirectory, image);
        await mkdir(path.dirname(destination), { recursive: true });

        let destinationExists = true;
        try {
            await access(destination);
        } catch {
            destinationExists = false;
        }

        if (!destinationExists) {
            await writeFile(destination, image.normalized, { flag: "wx" });
            createdDestination = true;
        }

        const stored = await readFile(destination);
        const storedHash = createHash("sha256").update(stored).digest("hex");
        if (storedHash !== image.contentHash) {
            if (createdDestination) await unlink(destination).catch(() => undefined);
            throw new Error("Destination image failed SHA-256 verification.");
        }

        uploadId = randomUUID();
        reused = false;
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            if (!uploadId) throw new Error("Internal error: upload ID was not prepared.");

            if (!existing) {
                const thumbhash = await generateThumbHash(destination!);

                await tx.upload.create({
                    data: {
                        id: uploadId,
                        filename: path
                            .relative(uploadDirectory, destination!)
                            .split(path.sep)
                            .join("/"),
                        originalName: image.originalName,
                        mimeType: image.mimeType,
                        size: image.normalized.byteLength,
                        width: image.width,
                        height: image.height,
                        contentHash: image.contentHash,
                        thumbhash,
                        metadataJson: image.metadataJson,
                        userId,
                    },
                });
            }

            const post = await tx.post.create({
                data: {
                    title: path.parse(image.originalName).name.trim() || "Untitled",
                    contentType: "image",
                    textContent: null,
                    description: null,
                    caption: null,
                    sourceUrl: null,
                    originalCreator: null,
                    originalCreatedAt: null,
                    allowDownload: true,
                    status: "draft",
                    visibility: "private",
                    publishedAt: null,
                    scheduledAt: null,
                    hiddenAt: null,
                    contentWarning: null,
                    permalinkPattern: "user",
                    permalinkIdType: "internalId",
                    customPostId: null,
                    userId,
                    categoryId: null,
                    uploads: { connect: [{ id: uploadId }] },
                },
            });

            return tx.post.update({
                where: { id: post.id },
                data: {
                    permalinkKey: permalinkBase(
                        post,
                        "internalId" as PermalinkIdType,
                    ),
                },
                select: { id: true },
            });
        });

        return { postId: result.id, uploadId, reused };
    } catch (error) {
        if (createdDestination) {
            await unlink(destination!).catch(() => undefined);
        }
        throw error;
    }
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const config = await loadConfig();
    const uploadDirectory = path.resolve(process.cwd(), config.storage.uploadDirectory);
    const sourceFiles = options.directory
        ? await collectDirectoryFiles(path.resolve(options.directory), options.recursive)
        : options.files.map((file) => path.resolve(file));

    const supportedFiles = sourceFiles.filter(isSupportedSource);
    const ignoredFiles = sourceFiles.filter((file) => !isSupportedSource(file));

    if (!supportedFiles.length)
        throw new Error("No supported image files were found.");

    if (ignoredFiles.length) {
        console.warn(
            "Ignoring unsupported file(s): " +
                ignoredFiles.map((file) => path.basename(file)).join(", "),
        );
    }

    const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
    const prisma = new PrismaClient({ adapter });

    try {
        const user = await resolveUser(prisma, options.user);
        if (!user) throw new Error("User not found: " + options.user);

        console.log(
            (options.apply ? "IMPORTING " : "DRY RUN: ") +
                supportedFiles.length +
                " image(s) as user " +
                (user.handle ? "@" + user.handle : user.id),
        );

        const preparedFiles = await preflight(prisma, user.id, supportedFiles);

        if (options.check || !options.apply) return;

        console.log("Preflight passed. Applying " + preparedFiles.length + " image import(s)...");

        let imported = 0;
        let skipped = 0;
        let failed = 0;

        for (const { source, image } of preparedFiles) {
            try {
                const existing = await prisma.upload.findUnique({
                    where: {
                        userId_contentHash: {
                            userId: user.id,
                            contentHash: image.contentHash,
                        },
                    },
                    select: { id: true, postId: true },
                });

                if (existing?.postId) {
                    skipped += 1;
                    console.log(
                        "SKIP " +
                            image.originalName +
                            ": already attached to post " +
                            existing.postId,
                    );
                    continue;
                }

                const title = path.parse(image.originalName).name.trim() || "Untitled";
                console.log(
                    "IMPORT " +
                        image.originalName +
                        " -> draft " +
                        JSON.stringify(title) +
                        " (" +
                        image.mimeType +
                        ")",
                );

                const result = await createDraft(
                    prisma,
                    path.resolve(process.cwd(), config.storage.uploadDirectory),
                    user.id,
                    image,
                );

                imported += 1;
                console.log(
                    "  post=" +
                        result.postId +
                        " upload=" +
                        result.uploadId +
                        (result.reused ? " (reused upload)" : ""),
                );

                if (options.deleteSource) await unlink(source);
            } catch (error) {
                failed += 1;
                console.error(
                    "FAILED " +
                        source +
                        ": " +
                        (error instanceof Error ? error.message : String(error)),
                );
            }
        }

        console.log(
            "Import complete: " +
                imported +
                " imported/planned, " +
                skipped +
                " skipped, " +
                failed +
                " failed.",
        );

        if (failed > 0) process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
