import { Parser } from "htmlparser2";

export interface PostyBirbUploadMetadata {
    alt: string | null;
    sourceUrls: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function postyBirbDescriptionToText(value: string): string {
    const ignoredElements = new Set(["script", "style", "iframe", "object", "svg", "noscript"]);
    const blockElements = new Set([
        "address",
        "article",
        "blockquote",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "ol",
        "p",
        "pre",
        "section",
        "table",
        "tr",
        "ul",
    ]);

    let text = "";
    let ignoredDepth = 0;

    const parser = new Parser(
        {
            onopentag(name) {
                if (ignoredDepth > 0) {
                    if (ignoredElements.has(name)) ignoredDepth++;
                    return;
                }

                if (ignoredElements.has(name)) {
                    ignoredDepth = 1;
                    return;
                }

                if (name === "br") text += "\n";
            },
            ontext(value) {
                if (ignoredDepth === 0) text += value;
            },
            onclosetag(name) {
                if (ignoredDepth > 0) {
                    if (ignoredElements.has(name)) ignoredDepth--;
                    return;
                }

                if (blockElements.has(name)) text += "\n";
            },
        },
        { decodeEntities: true },
    );

    parser.end(value);

    return text
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function parsePostyBirbTags(value: string): string[] {
    return [
        ...new Set(
            value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
        ),
    ];
}

export function mergePostyBirbUploadMetadata(
    metadataJson: string | null,
    metadata: PostyBirbUploadMetadata,
): string {
    let current: Record<string, unknown> = {};

    try {
        current = asRecord(metadataJson ? JSON.parse(metadataJson) : {});
    } catch {
        // Keep the upload usable even if its existing metadata is malformed.
    }

    return JSON.stringify({
        ...current,
        postyBirb: metadata,
    });
}

export function readPostyBirbUploadMetadata(metadataJson: string | null): PostyBirbUploadMetadata {
    try {
        const root = asRecord(metadataJson ? JSON.parse(metadataJson) : {});
        const metadata = asRecord(root.postyBirb);

        return {
            alt: typeof metadata.alt === "string" ? metadata.alt : null,
            sourceUrls: Array.isArray(metadata.sourceUrls)
                ? metadata.sourceUrls.filter((value): value is string => typeof value === "string")
                : [],
        };
    } catch {
        return {
            alt: null,
            sourceUrls: [],
        };
    }
}

export function isPostyBirbSourceUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}
