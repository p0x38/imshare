import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SIZES = [320, 640, 1280] as const;

export async function generateThumbnails(source: string, cacheDir: string, uploadId: string): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await Promise.all(SIZES.map(async (width) => {
    const destination = path.join(cacheDir, `${uploadId}-${width}xauto-inside.webp`);
    try { await access(destination); return; } catch {}
    const output = await sharp(source).resize({ width, fit: "inside", withoutEnlargement: true }).webp().toBuffer();
    await writeFile(destination, output, { flag: "wx" }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
  }));
}

export function queueThumbnailGeneration(source: string, cacheDir: string, uploadId: string): void {
  setImmediate(() => {
    void generateThumbnails(source, cacheDir, uploadId).catch((error) => {
      console.error(`thumbnail generation failed for ${uploadId}`, error);
    });
  });
}
