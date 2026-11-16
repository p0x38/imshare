export interface PostyBirbUploadMetadata {
    alt: string | null;
    sourceUrls: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function decodeHtmlEntities(value: string): string {
    return value.replace(
        /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip);/gi,
        (entity, reference: string) => {
            const key = reference.toLowerCase();

            if (key.startsWith("#")) {
                const codePoint = key.startsWith("#x")
                    ? Number.parseInt(key.slice(2), 16)
                    : Number.parseInt(key.slice(1), 10);

                if (
                    !Number.isInteger(codePoint) ||
                    codePoint <= 0 ||
                    codePoint > 0x10ffff ||
                    (codePoint >= 0xd800 && codePoint <= 0xdfff)
                ) {
                    return entity;
                }

                return String.fromCodePoint(codePoint);
            }

            return (
                {
                    amp: "&",
                    lt: "<",
                    gt: ">",
                    quot: '"',
                    apos: "'",
                    nbsp: " ",
                    rsquo: "’",
                    lsquo: "‘",
                    rdquo: "”",
                    ldquo: "“",
                    mdash: "—",
                    ndash: "–",
                    hellip: "…",
                }[key] ?? entity
            );
        },
    );
}

export function postyBirbDescriptionToText(value: string): string {
    let text = value;
    let previous: string;

    do {
        previous = text;
        text = text
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<(script|style|iframe|object|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(
                /<\/(?:div|p|li|h[1-6]|blockquote|pre|section|article|ul|ol|tr|td|th)\s*>/gi,
                "\n",
            )
            .replace(/<[^>]*>/g, "");
    } while (text !== previous);

    return decodeHtmlEntities(text)
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
