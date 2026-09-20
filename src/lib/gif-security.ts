const MAX_GIF_FRAMES = 600;
const MAX_GIF_TOTAL_PIXELS = 250_000_000;
const MAX_GIF_DURATION_MS = 120_000;
const MAX_GIF_FRAME_WIDTH = 4096;
const MAX_GIF_FRAME_HEIGHT = 4096;

export const GIF_SHARP_PIXEL_LIMIT = MAX_GIF_TOTAL_PIXELS;

export interface AnimatedImageMetadata {
    format?: string;
    width?: number;
    height?: number;
    pages?: number;
    pageHeight?: number;
    delay?: number[];
}

export function validateGifMetadata(metadata: AnimatedImageMetadata): void {
    const width = metadata.width ?? 0;
    const pageHeight = metadata.pageHeight ?? metadata.height ?? 0;
    const pages = metadata.pages ?? 1;

    if (!width || !pageHeight) throw new Error("GIF has no readable frame dimensions.");
    if (width > MAX_GIF_FRAME_WIDTH || pageHeight > MAX_GIF_FRAME_HEIGHT)
        throw new Error(
            `GIF frame dimensions exceed the ${MAX_GIF_FRAME_WIDTH}x${MAX_GIF_FRAME_HEIGHT} limit.`,
        );
    if (!Number.isSafeInteger(pages) || pages < 1 || pages > MAX_GIF_FRAMES)
        throw new Error(
            `GIF contains too many frames. The maximum is ${MAX_GIF_FRAMES}.`,
        );

    const totalPixels = width * pageHeight * pages;
    if (!Number.isSafeInteger(totalPixels) || totalPixels > MAX_GIF_TOTAL_PIXELS)
        throw new Error(
            `GIF contains too many decoded pixels. The maximum is ${MAX_GIF_TOTAL_PIXELS.toLocaleString()} pixels across all frames.`,
        );

    if (metadata.delay) {
        const duration = metadata.delay.reduce((sum, delay) => sum + Math.max(0, delay), 0);
        if (!Number.isSafeInteger(duration) || duration > MAX_GIF_DURATION_MS)
            throw new Error(
                `GIF animation duration exceeds the ${MAX_GIF_DURATION_MS / 1000}-second limit.`,
            );
    }
}
