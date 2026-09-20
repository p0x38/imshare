import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { env } from "../lib/env.js";
import { loadConfig } from "../lib/config.js";
import { generateThumbHash } from "../lib/thumbnails.js";

interface ImportMetadata {
    name?: string;
    originalPostDate?: string | number | null;
    description?: string | null;
    originalAuthor?: string | null;
    originalUrl?: string | null;
    tags?: string[];
    categories?: string[];
    caption?: string | null;
    visibility?: "public" | "unlisted" | "private";
    allowDownload?: boolean;
    contentWarning?: string | null;
    [key: string]: unknown;
}

interface Options {
    directory: string;
    user: string;
    apply: boolean;
    deleteSource: boolean;
    recursive: boolean;
    allowMissingJson: boolean;
    noPost: boolean;
}

interface PreparedImage {
    contentHash: string;
    extension: string;
    mimeType: string;
    normalized: Buffer;
    width: number;
    height: number;
}

const IMAGE_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
};

function parseOptions(argv: string[]): Options {
    let directory = "";
    let user = "";

    const options = {
        apply: false,
        deleteSource: false,
        recursive: true,
        allowMissingJson: false,
        noPost: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--directory" || arg === "-d") directory = argv[++index] ?? "";
        else if (arg === "--user" || arg === "-u") user = argv[++index] ?? "";
        else if (arg === "--apply") options.apply = true;
        else if (arg === "--delete-source") options.deleteSource = true;
        else if (arg === "--no-recursive") options.recursive = false;
        else if (arg === "--allow-missing-json") options.allowMissingJson = true;
        else if (arg === "--no-post") options.noPost = true;
        else if (arg === "--help" || arg === "-h") {
            console.log(
                [
                    "Usage: pnpm migrate:images --directory <path> --user <id-or-handle> [options]",
                    "",
                    "Expected files:",
                    "  image.png",
                    "  image.png.json",
                    "",
                    "JSON fields:",
                    "  name, originalPostDate, description, originalAuthor, originalUrl,",
                    "  tags, categories, caption, visibility, allowDownload, contentWarning",
                    "",
                    "Description imports with originalUrl are stored as:",
                    "  <description>",
                    "",
                    "  Imported from <originalUrl> using custom importer",
                    "",
                    "Without --apply, this command only performs a dry run.",
                    "",
                    "--directory <path>       Source directory.",
                    "--user <id-or-handle>    Destination imshare user.",
                    "--apply                  Write files and database records.",
                    "--delete-source         Delete source image/JSON after successful import.",
                    "--no-recursive           Do not scan subdirectories.",
                    "--allow-missing-json    Import images without usable JSON metadata.",
                    "--no-post                Import only Upload records.",
                    "--help                   Show this help.",
                ].join("\n"),
            );
            process.exit(0);
        } else {
            throw new Error("Unknown option: " + arg);
        }
    }

    if (!directory) throw new Error("--directory is required.");
    if (!user) throw new Error("--user is required.");
    if (options.deleteSource && !options.apply)
        throw new Error("--delete-source requires --apply.");

    return { ...options, directory, user };
}

async function collectFiles(root: string, recursive: boolean, relative = ""): Promise<string[]> {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const child = path.join(relative, entry.name);

        if (entry.isDirectory() && recursive)
            files.push(...(await collectFiles(root, recursive, child)));
        else if (entry.isFile())
            files.push(child);
    }

    return files;
}

function normalizeRelative(value: string): string {
    return value.replaceAll("\\", "/");
}

function matchingJson(files: string[], imageRelative: string): string | undefined {
    const expected = (normalizeRelative(imageRelative) + ".json").toLowerCase();
    return files.find((file) => normalizeRelative(file).toLowerCase() === expected);
}

function parseMetadata(raw: string): ImportMetadata {
    const value: unknown = JSON.parse(raw);

    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("JSON root must be an object.");

    return value as ImportMetadata;
}

function cleanString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return [
        ...new Set(
            value
                .map(cleanString)
                .filter((item): item is string => item !== undefined),
        ),
    ];
}

function parseOriginalDate(value: ImportMetadata["originalPostDate"]): Date | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    if (typeof value !== "string" || !value.trim()) return undefined;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function appendImportAttribution(
    description: string | undefined,
    originalUrl: string | undefined,
): string | undefined {
    if (!originalUrl) return description;

    const attribution = "Imported from " + originalUrl + " using custom importer";
    return description ? description + "\n\n" + attribution : attribution;
}

function slugify(value: string): string {
    const slug = value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/\s+/gu, "-")
        .replace(/[^\p{L}\p{N}_-]/gu, "")
        .replace(/-+/gu, "-")
        .replace(/^-|-$/gu, "");

    return slug || "tag-" + createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function normalizeVisibility(value: unknown): "public" | "unlisted" | "private" {
    return value === "unlisted" || value === "private" ? value : "public";
}

function targetFilename(contentHash: string, extension: string): string {
    return path.posix.join(
        contentHash.slice(0, 2),
        contentHash.slice(0, 4),
        contentHash + extension,
    );
}

async function resolveUser(prisma: PrismaClient, value: string) {
    return (
        (await prisma.user.findUnique({
            where: { id: value },
            select: { id: true, handle: true },
        })) ??
        (await prisma.user.findUnique({
            where: { handle: value },
            select: { id: true, handle: true },
        }))
    );
}

async function normalizeImage(source: string): Promise<PreparedImage> {
    const original = await sharp(source, { animated: true }).metadata();

    if (!original.width || !original.height)
        throw new Error("Unable to read image dimensions.");

    const normalized = await sharp(source, { animated: true })
        .rotate()
        .toColorspace("srgb")
        .toBuffer();

    const metadata = await sharp(normalized, { animated: true }).metadata();

    if (!metadata.width || !metadata.height)
        throw new Error("Unable to read normalized image dimensions.");

    const extension = path.extname(source).toLowerCase();
    const mimeType = IMAGE_TYPES[extension];

    if (!mimeType) throw new Error("Unsupported image extension: " + extension);

    return {
        contentHash: createHash("sha256").update(normalized).digest("hex"),
        extension,
        mimeType,
        normalized,
        width: metadata.width,
        height: metadata.height,
    };
}

async function resolveTag(prisma: PrismaClient, name: string) {
    const trimmed = name.trim();
    const slug = slugify(trimmed);

    return (
        (await prisma.tag.findUnique({ where: { name: trimmed } })) ??
        (await prisma.tag.findUnique({ where: { slug } })) ??
        (await prisma.tag.create({ data: { name: trimmed, slug } }))
    );
}

async function resolveCategory(prisma: PrismaClient, name: string) {
    const trimmed = name.trim();
    const slug = slugify(trimmed);

    return (
        (await prisma.category.findUnique({ where: { name: trimmed } })) ??
        (await prisma.category.findUnique({ where: { slug } })) ??
        (await prisma.category.create({ data: { name: trimmed, slug } }))
    );
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const config = await loadConfig();
    const sourceDirectory = path.resolve(options.directory);
    const uploadDirectory = path.resolve(process.cwd(), config.storage.uploadDirectory);

    const sourceStats = await stat(sourceDirectory).catch(() => undefined);
    if (!sourceStats?.isDirectory())
        throw new Error("Source directory does not exist: " + sourceDirectory);

    const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
    const prisma = new PrismaClient({ adapter });

    try {
        const user = await resolveUser(prisma, options.user);
        if (!user) throw new Error("User not found: " + options.user);

        const files = await collectFiles(sourceDirectory, options.recursive);
        const images = files
            .filter((file) => Boolean(IMAGE_TYPES[path.extname(file).toLowerCase()]))
            .sort();

        let processed = 0;
        let skipped = 0;
        let failed = 0;

        for (const relativeImage of images) {
            const source = path.join(sourceDirectory, relativeImage);
            const jsonRelative = matchingJson(files, relativeImage);
            const jsonSource = jsonRelative
                ? path.join(sourceDirectory, jsonRelative)
                : undefined;

            let metadata: ImportMetadata = {};

            if (jsonSource) {
                try {
                    metadata = parseMetadata(await readFile(jsonSource, "utf8"));
                } catch (error) {
                    if (!options.allowMissingJson) {
                        skipped += 1;
                        console.error(
                            "SKIP " + normalizeRelative(relativeImage) + ": invalid JSON (" +
                                (error instanceof Error ? error.message : String(error)) + ")",
                        );
                        continue;
                    }

                    console.warn(
                        "WARN " + normalizeRelative(relativeImage) +
                            ": invalid JSON; importing without metadata.",
                    );
                }
            } else if (!options.allowMissingJson) {
                skipped += 1;
                console.error(
                    "SKIP " + normalizeRelative(relativeImage) + ": matching JSON file not found.",
                );
                continue;
            }

            try {
                const prepared = await normalizeImage(source);
                const existing = await prisma.upload.findUnique({
                    where: {
                        userId_contentHash: {
                            userId: user.id,
                            contentHash: prepared.contentHash,
                        },
                    },
                    select: { id: true, filename: true, postId: true },
                });

                const destinationFilename = targetFilename(
                    prepared.contentHash,
                    prepared.extension,
                );
                const destination = path.join(uploadDirectory, destinationFilename);

                const name =
                    cleanString(metadata.name) ??
                    path.basename(relativeImage, path.extname(relativeImage));
                const originalUrl = cleanString(metadata.originalUrl);
                const description = appendImportAttribution(
                    cleanString(metadata.description),
                    originalUrl,
                );
                const originalAuthor = cleanString(metadata.originalAuthor);
                const originalPostDate = parseOriginalDate(metadata.originalPostDate);
                const tags = cleanStringList(metadata.tags);
                const categories = cleanStringList(metadata.categories);
                const category = categories[0];
                const caption = cleanString(metadata.caption);
                const visibility = normalizeVisibility(metadata.visibility);
                const allowDownload =
                    typeof metadata.allowDownload === "boolean"
                        ? metadata.allowDownload
                        : true;
                const contentWarning = cleanString(metadata.contentWarning);

                if (categories.length > 1) {
                    console.warn(
                        "WARN " + normalizeRelative(relativeImage) +
                            ': imshare currently supports one category per post; using first category "' +
                            category +
                            '".',
                    );
                }

                console.log(
                    (options.apply ? "IMPORT " : "WOULD IMPORT ") +
                        normalizeRelative(relativeImage) +
                        " -> " +
                        destinationFilename,
                );

                if (!options.apply) {
                    processed += 1;
                    continue;
                }

                await mkdir(path.dirname(destination), { recursive: true });

                if (!existing) {
                    await writeFile(destination, prepared.normalized, { flag: "wx" }).catch(
                        (error: unknown) => {
                            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
                        },
                    );

                    const stored = await readFile(destination);
                    const storedHash = createHash("sha256").update(stored).digest("hex");

                    if (storedHash !== prepared.contentHash)
                        throw new Error("Destination image failed SHA-256 verification.");

                    const thumbhash = await generateThumbHash(destination);
                    const uploadId = randomUUID();

                    if (options.noPost) {
                        await prisma.upload.create({
                            data: {
                                id: uploadId,
                                filename: destinationFilename,
                                originalName: path.basename(relativeImage),
                                mimeType: prepared.mimeType,
                                size: stored.byteLength,
                                width: prepared.width,
                                height: prepared.height,
                                contentHash: prepared.contentHash,
                                thumbhash,
                                metadataJson: JSON.stringify(metadata),
                                userId: user.id,
                            },
                        });
                    } else {
                        await prisma.$transaction(async (tx) => {
                            const resolvedCategory = category
                                ? await resolveCategory(tx, category)
                                : undefined;

                            const post = await tx.post.create({
                                data: {
                                    title: name,
                                    contentType: "image",
                                    description,
                                    caption,
                                    sourceUrl: originalUrl,
                                    originalCreator: originalAuthor,
                                    originalCreatedAt: originalPostDate,
                                    allowDownload,
                                    status: "published",
                                    visibility,
                                    publishedAt: new Date(),
                                    contentWarning,
                                    userId: user.id,
                                    categoryId: resolvedCategory?.id,
                                },
                            });

                            await tx.upload.create({
                                data: {
                                    id: uploadId,
                                    filename: destinationFilename,
                                    originalName: path.basename(relativeImage),
                                    mimeType: prepared.mimeType,
                                    size: stored.byteLength,
                                    width: prepared.width,
                                    height: prepared.height,
                                    contentHash: prepared.contentHash,
                                    thumbhash,
                                    metadataJson: JSON.stringify(metadata),
                                    userId: user.id,
                                    postId: post.id,
                                },
                            });

                            for (const tagName of tags) {
                                const tag = await resolveTag(tx, tagName);

                                await tx.postTag.create({
                                    data: { postId: post.id, tagId: tag.id },
                                });
                            }

                            await tx.post.update({
                                where: { id: post.id },
                                data: { permalinkKey: post.id },
                            });
                        });
                    }
                } else if (!options.noPost && !existing.postId) {
                    await prisma.$transaction(async (tx) => {
                        const resolvedCategory = category
                            ? await resolveCategory(tx, category)
                            : undefined;

                        const post = await tx.post.create({
                            data: {
                                title: name,
                                contentType: "image",
                                description,
                                caption,
                                sourceUrl: originalUrl,
                                originalCreator: originalAuthor,
                                originalCreatedAt: originalPostDate,
                                allowDownload,
                                status: "published",
                                visibility,
                                publishedAt: new Date(),
                                contentWarning,
                                userId: user.id,
                                categoryId: resolvedCategory?.id,
                            },
                        });

                        await tx.upload.update({
                            where: { id: existing.id },
                            data: { postId: post.id },
                        });

                        for (const tagName of tags) {
                            const tag = await resolveTag(tx, tagName);

                            await tx.postTag.create({
                                data: { postId: post.id, tagId: tag.id },
                            });
                        }

                        await tx.post.update({
                            where: { id: post.id },
                            data: { permalinkKey: post.id },
                        });
                    });
                } else {
                    console.log(
                        "SKIP existing upload " + existing.id + " (" + existing.filename + ")",
                    );
                }

                if (options.deleteSource) {
                    const { unlink } = await import("node:fs/promises");
                    await unlink(source);

                    if (jsonSource) await unlink(jsonSource).catch(() => undefined);
                }

                processed += 1;
            } catch (error) {
                failed += 1;
                console.error(
                    "FAILED " + normalizeRelative(relativeImage) + ": " +
                        (error instanceof Error ? error.message : String(error)),
                );
            }
        }

        console.log(
            "Migration complete: " + processed + " imported/planned, " +
                skipped + " skipped, " + failed + " failed.",
        );
    } finally {
        await prisma.$disconnect();
    }
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
