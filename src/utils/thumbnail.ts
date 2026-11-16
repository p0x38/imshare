import sharp from "sharp";
import type { Sharp } from "sharp";

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
const MAX_SIZE = 480 * 1024;
const QUALITIES = [82, 76, 70, 64];

export type ThumbnailFormat = "jpeg" | "webp" | "png" | "avif";
export type ThumbnailFit = "cover" | "contain" | "fill" | "inside" | "outside";
export type ThumbnailBackgroundStyle = "solid" | "transparent" | "blur";

export interface ThumbnailOptions {
    width?: number;
    height?: number;
    fit?: ThumbnailFit;
    format?: ThumbnailFormat;
    quality?: number;
    background?: string;
    backgroundStyle?: ThumbnailBackgroundStyle;
    position?: string;
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    fit: "contain",
    format: "jpeg",
    quality: 82,
    background: "#121212",
    backgroundStyle: "solid",
    position: "centre",
};

export function getThumbnailMimeType(format: ThumbnailFormat): string {
    return {
        jpeg: "image/jpeg",
        webp: "image/webp",
        png: "image/png",
        avif: "image/avif",
    }[format];
}

export async function generateThumbnail(
    source: Buffer,
    options: ThumbnailOptions = {},
): Promise<Buffer> {
    const settings = { ...DEFAULT_OPTIONS, ...options };
    const { width, height, fit, format, quality, background, backgroundStyle, position } = settings;

    const input = sharp(source, { animated: false }).rotate();

    let pipeline: Sharp;

    if (backgroundStyle === "blur") {
        const backgroundImage = await input
            .clone()
            .resize(width, height, {
                fit: "cover",
                position,
            })
            .blur(24)
            .toBuffer();

        const foreground = await input
            .clone()
            .resize(width, height, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer();

        pipeline = sharp(backgroundImage).composite([{ input: foreground }]);
    } else {
        pipeline = input.resize(width, height, {
            fit,
            position,
            background:
                backgroundStyle === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : background,
        });
    }

    if (format === "jpeg") {
        if (backgroundStyle === "transparent") {
            pipeline = pipeline.flatten({ background });
        }

        const qualities = quality === 82 ? QUALITIES : [quality, Math.max(quality - 8, 1)];

        let output = Buffer.alloc(0);

        for (const currentQuality of qualities) {
            output = await pipeline
                .clone()
                .jpeg({ quality: currentQuality, mozjpeg: true })
                .toBuffer();

            if (output.byteLength <= MAX_SIZE) break;
        }

        return output;
    }

    switch (format) {
        case "webp":
            return pipeline.webp({ quality }).toBuffer();
        case "png":
            return pipeline.png({ compressionLevel: 9 }).toBuffer();
        case "avif":
            return pipeline.avif({ quality }).toBuffer();
    }
}
