import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { ensureCacheDirectory, getCacheSettings, readCacheFile, resolveCachePath } from "./cache.js";
import { observability } from "../instrumentation.js";

const SIZES = [320, 640, 1280] as const;

export async function generateThumbHash(source: string): Promise<string> {
    const startedAt = process.hrtime.bigint();
    try {
        const { data, info } = await sharp(source)
            .ensureAlpha()
            .resize(100, 100, { fit: "inside", withoutEnlargement: true })
            .raw()
            .toBuffer({ resolveWithObject: true });
        const result = Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString(
            "base64",
        );
        observability.recordImageProcessing(
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
            "thumbhash",
        );
        observability.recordImageTransformation("thumbhash");
        return result;
    } catch (error) {
        observability.recordImageProcessingError("thumbhash");
        throw error;
    }
}

export async function generateThumbnails(source: string, uploadId: string): Promise<void> {
    const cacheSettings = getCacheSettings();
    const cacheDir = await ensureCacheDirectory();
    const startedAt = process.hrtime.bigint();
    try {
        await Promise.all(
            SIZES.map(async (width) => {
                const key = `${uploadId}-${width}xauto-inside.webp`;
                const destination = resolveCachePath(cacheDir, key, cacheSettings.useHashedDirectory);
                if (await readCacheFile(destination, cacheSettings.ttl)) return;
                await mkdir(path.dirname(destination), { recursive: true });
                const output = await sharp(source)
                    .resize({ width, fit: "inside", withoutEnlargement: true })
                    .webp()
                    .toBuffer();
                await writeFile(destination, output, { flag: "wx" }).catch((error: unknown) => {
                    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
                });
            }),
        );
        observability.recordImageProcessing(
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
            "thumbnail",
        );
        observability.recordImageTransformation("thumbnail", "webp");
    } catch (error) {
        observability.recordImageProcessingError("thumbnail");
        throw error;
    }
}

export function queueThumbnailGeneration(source: string, uploadId: string): void {
    setImmediate(() => {
        void generateThumbnails(source, uploadId).catch((error) => {
            console.error(`thumbnail generation failed for ${uploadId}`, error);
        });
    });
}
