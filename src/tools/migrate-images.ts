import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { env } from "../lib/env.js";
import { loadConfig } from "../lib/config.js";
import { generateThumbHash } from "../lib/thumbnails.js";

interface ImportMetadata {
    file: string;
    name: string;
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
}

interface Options {
    directory: string;
    user: string;
    apply: boolean;
    deleteSource: boolean;
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
        noPost: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--directory" || arg === "-d") directory = argv[++index] ?? "";
        else if (arg === "--user" || arg === "-u") user = argv[++index] ?? "";
        else if (arg === "--apply") options.apply = true;
        else if (arg === "--delete-source") options.deleteSource = true;
        else if (arg === "--no-post") options.noPost = true;
        else if (arg === "--help" || arg === "-h") {
            console.log(
                [
                    "Usage: pnpm migrate:images --directory <lists-root> --user <id-or-handle> [options]",
                    "",
                    "Expected layout:",
                    "  lists/",
                    "    list.json",
                    "    source-a/",
                    "      image1.png",
                    "      image2.jpg",
                    "    source-b/",
                    "      nested/",
                    "        image3.webp",
                    "",
                    "The root list.json contains an array of image metadata objects.",
                    "",
                    "Example list.json:",
                    "  [",
                    "    {",
                    '      "file": "image1.png",',
                    '      "name": "Artwork title",',
                    '      "originalPostDate": "2024-01-15T12:34:56Z",',
                    '      "description": "Original description.",',
                    '      "originalAuthor": "artist",',
                    '      "originalUrl": "https://www.deviantart.com/...",',
                    '      "tags": ["art", "fanart"],',
                    '      "categories": ["Artwork"]',
                    "    }",
                    "  ]",
                    "",
                    "When originalUrl is present, description becomes:",
                    "  <description>",
                    "",
                    "  Imported from <originalUrl> using custom importer",
                    "",
                    "--directory <path>       Root directory containing list.json and source files.",
                    "--user <id-or-handle>    imshare user that owns imported data.",
                    "--apply                  Write files and database records.",
                    "--delete-source         Delete imported source images after success.",
                    "--no-post                Import Upload records without creating Posts.",
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

function normalizeRelative(value: string): string {
    return value.replaceAll("\\", "/");
}

function resolveWithinRoot(root: string, relative: string): string {
    const normalized = relative.replaceAll("\\", "/");

    if (!normalized || path.posix.isAbsolute(normalized))
        throw new Error("Metadata file path must be relative to the import root.");

    const target = path.resolve(root, normalized);
    const relativeTarget = path.relative(root, target);

    if (
        relativeTarget === ".." ||
        relativeTarget.startsWith(".." + path.sep) ||
        path.isAbsolute(relativeTarget)
    ) {
        throw new Error("Metadata file path escapes the import root: " + relative);
    }

    return target;
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

function parseListMetadata(raw: string): ImportMetadata[] {
    const value: unknown = JSON.parse(raw);

    if (!Array.isArray(value)) throw new Error("list.json root must be an array.");

    return value.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            throw new Error("list.json entry " + index + " must be an object.");

        const record = entry as Record<string, unknown>;
        const file = cleanString(record.file);
        const name = cleanString(record.name);

        if (!file) throw new Error("list.json entry " + index + " is missing file.");
        if (!name) throw new Error("list.json entry " + index + " is missing name.");

        return {
            ...record,
            file,
            name,
            originalPostDate: record.originalPostDate as ImportMetadata["originalPostDate"],
            description: record.description as string | null | undefined,
            originalAuthor: record.originalAuthor as string | null | undefined,
            originalUrl: record.originalUrl as string | null | undefined,
            tags: cleanStringList(record.tags),
            categories: cleanStringList(record.categories),
            caption: record.caption as string | null | undefined,
            visibility: normalizeVisibility(record.visibility),
            allowDownload:
                typeof record.allowDownload === "boolean" ? record.allowDownload : true,
            contentWarning: record.contentWarning as string | null | undefined,
        };
    });
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

async function resolveTag(tx: Prisma.TransactionClient, name: string) {
    const trimmed = name.trim();
    const slug = slugify(trimmed);

    return (
        (await tx.tag.findUnique({ where: { name: trimmed } })) ??
        (await tx.tag.findUnique({ where: { slug } })) ??
        (await tx.tag.create({ data: { name: trimmed, slug } }))
    );
}

async function resolveCategory(tx: Prisma.TransactionClient, name: string) {
    const trimmed = name.trim();
    const slug = slugify(trimmed);

    return (
        (await tx.category.findUnique({ where: { name: trimmed } })) ??
        (await tx.category.findUnique({ where: { slug } })) ??
        (await tx.category.create({ data: { name: trimmed, slug } }))
    );
}

async function importList(
    prisma: PrismaClient,
    sourceDirectory: string,
    uploadDirectory: string,
    userId: string,
    options: Options,
): Promise<{ imported: number; skipped: number; failed: number }> {
    const listPath = path.join(sourceDirectory, "list.json");

    let metadataEntries: ImportMetadata[];

    try {
        metadataEntries = parseListMetadata(await readFile(listPath, "utf8"));
    } catch (error) {
        throw new Error(
            "Unable to read root list.json: " +
                (error instanceof Error ? error.message : String(error)),
        );
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const referencedFiles = new Set<string>();

    for (const metadata of metadataEntries) {
        const relativeFile = normalizeRelative(metadata.file);
        const relativeKey = relativeFile.toLowerCase();

        if (referencedFiles.has(relativeKey)) {
            skipped += 1;
            console.error(
                "SKIP list.json: duplicate file " + relativeFile,
            );
            continue;
        }

        referencedFiles.add(relativeKey);

        try {
            const source = resolveWithinRoot(sourceDirectory, metadata.file);
            const sourceStats = await stat(source);

            if (!sourceStats.isFile()) throw new Error("Source path is not a file.");

            const extension = path.extname(source).toLowerCase();
            if (!IMAGE_TYPES[extension])
                throw new Error("Unsupported image extension: " + extension);

            const prepared = await normalizeImage(source);
            const existing = await prisma.upload.findUnique({
                where: {
                    userId_contentHash: {
                        userId,
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

            const originalUrl = cleanString(metadata.originalUrl);
            const description = appendImportAttribution(
                cleanString(metadata.description),
                originalUrl,
            );
            const tags = cleanStringList(metadata.tags);
            const categories = cleanStringList(metadata.categories);

            if (categories.length > 1) {
                console.warn(
                    "WARN " +
                        relativeFile +
                        ': imshare supports one category per post; using "' +
                        categories[0] +
                        '".',
                );
            }

            console.log(
                (options.apply ? "IMPORT " : "WOULD IMPORT ") +
                    relativeFile +
                    " -> " +
                    destinationFilename,
            );

            if (!options.apply) {
                imported += 1;
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
                            originalName: path.basename(source),
                            mimeType: prepared.mimeType,
                            size: stored.byteLength,
                            width: prepared.width,
                            height: prepared.height,
                            contentHash: prepared.contentHash,
                            thumbhash,
                            metadataJson: JSON.stringify(metadata),
                            userId,
                        },
                    });
                } else {
                    await prisma.$transaction(async (tx) => {
                        const category = categories[0]
                            ? await resolveCategory(tx, categories[0])
                            : undefined;

                        const post = await tx.post.create({
                            data: {
                                title: metadata.name,
                                contentType: "image",
                                description,
                                caption: cleanString(metadata.caption),
                                sourceUrl: originalUrl,
                                originalCreator: cleanString(metadata.originalAuthor),
                                originalCreatedAt: parseOriginalDate(
                                    metadata.originalPostDate,
                                ),
                                allowDownload: metadata.allowDownload ?? true,
                                status: "published",
                                visibility: normalizeVisibility(metadata.visibility),
                                publishedAt: new Date(),
                                contentWarning: cleanString(metadata.contentWarning),
                                userId,
                                categoryId: category?.id,
                            },
                        });

                        await tx.upload.create({
                            data: {
                                id: uploadId,
                                filename: destinationFilename,
                                originalName: path.basename(source),
                                mimeType: prepared.mimeType,
                                size: stored.byteLength,
                                width: prepared.width,
                                height: prepared.height,
                                contentHash: prepared.contentHash,
                                thumbhash,
                                metadataJson: JSON.stringify(metadata),
                                userId,
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
                    const category = categories[0]
                        ? await resolveCategory(tx, categories[0])
                        : undefined;

                    const post = await tx.post.create({
                        data: {
                            title: metadata.name,
                            contentType: "image",
                            description,
                            caption: cleanString(metadata.caption),
                            sourceUrl: originalUrl,
                            originalCreator: cleanString(metadata.originalAuthor),
                            originalCreatedAt: parseOriginalDate(
                                metadata.originalPostDate,
                            ),
                            allowDownload: metadata.allowDownload ?? true,
                            status: "published",
                            visibility: normalizeVisibility(metadata.visibility),
                            publishedAt: new Date(),
                            contentWarning: cleanString(metadata.contentWarning),
                            userId,
                            categoryId: category?.id,
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
                await unlink(source);
            }

            imported += 1;
        } catch (error) {
            failed += 1;
            console.error(
                "FAILED " +
                    relativeFile +
                    ": " +
                    (error instanceof Error ? error.message : String(error)),
            );
        }
    }

    return { imported, skipped, failed };
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

        const result = await importList(
            prisma,
            sourceDirectory,
            uploadDirectory,
            user.id,
            options,
        );

        console.log(
            "Migration complete: " +
                result.imported +
                " imported/planned, " +
                result.skipped +
                " skipped, " +
                result.failed +
                " failed.",
        );
    } finally {
        await prisma.$disconnect();
    }
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
