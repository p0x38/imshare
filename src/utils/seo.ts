import { escapeAttribute, escapeJsonLd, escapeMeta } from "./html.js";

export interface SeoProfileMetadata {
    name: string;
    url: string;
    identifier?: string;
    alternateName?: string;
    description?: string;
    image?: string;
    dateCreated?: Date;
    dateModified?: Date;
}

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
    structuredDataType?: "WebSite" | "ProfilePage";
    profile?: SeoProfileMetadata;
    text?: string;
    datePublished?: Date;
    dateModified?: Date;
    authorUrl?: string;
}

export function truncateDescription(value: string, maxLength = 160): string {
    const normalized = value.replace(/\s+/g, " ").trim();

    if (normalized.length <= maxLength) return normalized;

    const truncated = normalized.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}

export function generateSeoTitle(title: string, siteName: string): string {
    const normalizedTitle = title.trim();
    const normalizedSiteName = siteName.trim();

    if (!normalizedTitle) return normalizedSiteName;
    if (!normalizedSiteName || normalizedTitle.toLowerCase() === normalizedSiteName.toLowerCase())
        return normalizedTitle;

    const suffix = ` · ${normalizedSiteName}`;
    if (normalizedTitle.toLowerCase().endsWith(suffix.toLowerCase())) return normalizedTitle;

    return `${normalizedTitle} · ${normalizedSiteName}`;
}

export function generateSeoMetadata(metadata: SeoMetadata): string {
    const title = generateSeoTitle(metadata.title, metadata.siteName);
    const description = truncateDescription(metadata.description);
    const imageAlt = metadata.imageAlt?.trim() || metadata.title;
    const type = metadata.type ?? "website";

    const canonicalUrl = new URL(metadata.canonical);
    const siteUrl = canonicalUrl.origin;

    const websiteId = `${siteUrl}/#website`;
    const organizationId = `${siteUrl}/#organization`;
    const webpageId = `${metadata.canonical}#webpage`;
    const articleId = `${metadata.canonical}#article`;
    const profilePageId = `${metadata.canonical}#profilepage`;

    const structuredDataType =
        metadata.structuredDataType ?? (type === "article" ? "SocialMediaPosting" : "WebPage");

    const structuredData = {
        "@context": "https://schema.org",
        "@type": structuredDataType,
        "@id":
            structuredDataType === "WebSite"
                ? websiteId
                : structuredDataType === "ProfilePage"
                  ? profilePageId
                  : type === "article"
                    ? articleId
                    : webpageId,
        ...(structuredDataType === "WebSite"
            ? {
                  name: metadata.siteName,
                  url: metadata.canonical,
              }
            : {
                  name: metadata.title,
                  description,
                  url: metadata.canonical,
                  isPartOf: {
                      "@id": websiteId,
                  },
                  ...(structuredDataType === "ProfilePage"
                      ? {}
                      : metadata.image
                        ? { image: metadata.image }
                        : {}),
              }),
        ...(type === "article"
            ? {
                  mainEntityOfPage: {
                      "@id": webpageId,
                  },
                  publisher: {
                      "@type": "Organization",
                      "@id": organizationId,
                      name: metadata.siteName,
                      url: siteUrl,
                  },
              }
            : {}),
        ...(type === "article" && metadata.text ? { text: metadata.text } : {}),
        ...(type === "article" && metadata.datePublished
            ? { datePublished: metadata.datePublished.toISOString() }
            : {}),
        ...(type === "article" &&
        metadata.datePublished &&
        metadata.dateModified &&
        metadata.dateModified > metadata.datePublished
            ? { dateModified: metadata.dateModified.toISOString() }
            : {}),
        ...(type === "article" && metadata.author
            ? {
                  author: {
                      "@type": "Person",
                      ...(metadata.authorUrl
                          ? { "@id": `${metadata.authorUrl.replace(/\/$/, "")}#person` }
                          : {}),
                      name: metadata.author,
                      ...(metadata.authorUrl ? { url: metadata.authorUrl } : {}),
                  },
              }
            : {}),
        ...(structuredDataType === "ProfilePage" && metadata.profile
            ? {
                  ...(metadata.profile.dateCreated
                      ? { dateCreated: metadata.profile.dateCreated.toISOString() }
                      : {}),
                  ...(metadata.profile.dateModified &&
                  (!metadata.profile.dateCreated ||
                      metadata.profile.dateModified > metadata.profile.dateCreated)
                      ? { dateModified: metadata.profile.dateModified.toISOString() }
                      : {}),
                  mainEntity: {
                      "@type": "Person",
                      "@id": `${metadata.profile.url.replace(/\/$/, "")}#person`,
                      name: metadata.profile.name,
                      url: metadata.profile.url,
                      ...(metadata.profile.identifier
                          ? { identifier: metadata.profile.identifier }
                          : {}),
                      ...(metadata.profile.alternateName
                          ? { alternateName: metadata.profile.alternateName }
                          : {}),
                      ...(metadata.profile.description
                          ? { description: metadata.profile.description }
                          : {}),
                      ...(metadata.profile.image ? { image: metadata.profile.image } : {}),
                  },
              }
            : {}),
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
