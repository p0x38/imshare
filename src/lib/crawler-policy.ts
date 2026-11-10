export const CRAWLER_CATEGORIES = ["search", "ai", "image", "custom"] as const;

export type CrawlerCategory = (typeof CRAWLER_CATEGORIES)[number];

export type CrawlerPolicy = Record<CrawlerCategory, boolean>;

interface UserCrawlerPolicy {
    allowSearchEngineIndex: boolean;
    allowAiCrawler: boolean;
    allowImageCrawler: boolean;
    allowCustomCrawler: boolean;
}

interface PostCrawlerPolicy {
    allowSearchEngineIndex?: boolean | null;
    allowAiCrawler?: boolean | null;
    allowImageCrawler?: boolean | null;
    allowCustomCrawler?: boolean | null;
}

export const CRAWLER_USER_AGENTS = {
    search: ["Googlebot", "Bingbot", "DuckDuckBot", "Applebot", "YandexBot", "Baiduspider"],
    ai: [
        "GPTBot",
        "OAI-SearchBot",
        "ClaudeBot",
        "Claude-SearchBot",
        "PerplexityBot",
        "Bytespider",
        "CCBot",
        "Google-Extended",
        "Meta-ExternalAgent",
    ],
    image: ["Googlebot-Image", "Bingbot-Image"],
    custom: ["AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "DataForSeoBot", "SiteAuditBot"],
} as const satisfies Record<CrawlerCategory, readonly string[]>;

export function resolveCrawlerPolicy(
    user: UserCrawlerPolicy,
    post?: PostCrawlerPolicy | null,
): CrawlerPolicy {
    return {
        search: post?.allowSearchEngineIndex ?? user.allowSearchEngineIndex,

        ai: post?.allowAiCrawler ?? user.allowAiCrawler,

        image: post?.allowImageCrawler ?? user.allowImageCrawler,

        custom: post?.allowCustomCrawler ?? user.allowCustomCrawler,
    };
}

export function crawlerMetaContent(policy: CrawlerPolicy): string {
    return [!policy.search ? "noindex" : null, !policy.image ? "noimageindex" : null]
        .filter((directive): directive is string => directive !== null)
        .join(", ");
}
