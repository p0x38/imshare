import sharp from "sharp";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const MAX_SIZE = 480 * 1024;
const QUALITIES = [82, 76, 70, 64];

export async function generateOgImage(source: Buffer): Promise<Buffer> {
    let output = Buffer.alloc(0);

    for (const quality of QUALITIES) {
        output = await sharp(source, { animated: false })
            .rotate()
            .resize(OG_WIDTH, OG_HEIGHT, {
                fit: "contain",
                background: "#121212",
            })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();

        if (output.byteLength <= MAX_SIZE) break;
    }

    return output;
}
