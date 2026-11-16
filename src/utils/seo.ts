import { escapeAttribute, escapeJsonLd, escapeMeta } from "./html.js";

export interface SeoMetadata {
    title: string;
    description: string;
    canonical: string;
    siteName: string;
    twitterSite?: string;
    image?: string;
    imageAlt?: string;
    imageWidth?: number;
    imageHeight?: number;
    author?: string;
    keywords?: string;
    type?: "website" | "article";
    locale?: string;
    crawlerDirectives?: string;
}

export function truncateDescription(value: string, maxLength = 160): string {
    const normalized = value.replace(/\s+/g, " ").trim();

    if (normalized.length <= maxLength) return normalized;

    const truncated = normalized.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}

export function generateSeoTitle(title: string, siteName: string): string {
    return `${title} · ${siteName}`;
}

export function generateSeoMetadata(metadata: SeoMetadata): string {
    const title = generateSeoTitle(metadata.title, metadata.siteName);
    const description = truncateDescription(metadata.description);
    const imageAlt = metadata.imageAlt?.trim() || metadata.title;
    const type = metadata.type ?? "website";

    const structuredData = {
        "@context": "https://schema.org",
        "@type": type === "article" ? "SocialMediaPosting" : "WebPage",
        name: metadata.title,
        ...(type === "article" ? { headline: metadata.title } : {}),
        description,
        url: metadata.canonical,
        ...(metadata.image ? { image: metadata.image } : {}),
        ...(metadata.author ? { author: { "@type": "Person", name: metadata.author } } : {}),
    };

    const tags = [
        `<title>${escapeMeta(title)}</title>`,
        `<meta name="description" content="${escapeMeta(description)}">`,
        `<meta name="generator" content="${escapeAttribute(metadata.siteName)}">`,

        metadata.author ? `<meta name="author" content="${escapeMeta(metadata.author)}">` : "",

        metadata.keywords
            ? `<meta name="keywords" content="${escapeMeta(metadata.keywords)}">`
            : "",

        `<meta property="og:type" content="${type}">`,
        `<meta property="og:site_name" content="${escapeMeta(metadata.siteName)}">`,
        `<meta property="og:title" content="${escapeMeta(metadata.title)}">`,
        `<meta property="og:description" content="${escapeMeta(description)}">`,
        `<meta property="og:url" content="${escapeAttribute(metadata.canonical)}">`,
        `<meta property="og:locale" content="${escapeAttribute(metadata.locale ?? "en_US")}">`,

        metadata.image
            ? `<meta property="og:image" content="${escapeAttribute(metadata.image)}">`
            : "",
        metadata.image
            ? `<meta property="og:image:secure_url" content="${escapeAttribute(metadata.image)}">`
            : "",
        metadata.image ? `<meta property="og:image:alt" content="${escapeMeta(imageAlt)}">` : "",
        metadata.image && metadata.imageWidth
            ? `<meta property="og:image:width" content="${metadata.imageWidth}">`
            : "",
        metadata.image && metadata.imageHeight
            ? `<meta property="og:image:height" content="${metadata.imageHeight}">`
            : "",

        `<meta name="twitter:card" content="${metadata.image ? "summary_large_image" : "summary"}">`,
        `<meta name="twitter:title" content="${escapeMeta(metadata.title)}">`,
        `<meta name="twitter:description" content="${escapeMeta(description)}">`,
        metadata.twitterSite
            ? `<meta name="twitter:site" content="${escapeAttribute(metadata.twitterSite)}">`
            : "",

        metadata.image
            ? `<meta name="twitter:image" content="${escapeAttribute(metadata.image)}">`
            : "",
        metadata.image ? `<meta name="twitter:image:alt" content="${escapeMeta(imageAlt)}">` : "",

        `<script type="application/ld+json">${escapeJsonLd(structuredData)}</script>`,
        `<link rel="canonical" href="${escapeAttribute(metadata.canonical)}">`,

        metadata.crawlerDirectives ?? "",
    ];

    return tags.join("");
}
