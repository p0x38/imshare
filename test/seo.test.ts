import { describe, expect, it } from "vitest";
import { generateSeoMetadata, generateSeoTitle } from "../src/utils/seo.js";

function getStructuredData(html: string): Record<string, unknown> {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

    if (!match?.[1]) throw new Error("Structured data script was not generated.");
    return JSON.parse(match[1]) as Record<string, unknown>;
}

const baseMetadata = {
    title: "Example page",
    description: "An example description.",
    canonical: "https://example.com/example/",
    siteName: "Example",
};

describe("generateSeoTitle", () => {
    it("does not append the site name twice", () => {
        expect(generateSeoTitle("Example", "Example")).toBe("Example");
        expect(generateSeoTitle("Example page · Example", "Example")).toBe(
            "Example page · Example",
        );
    });
});

describe("generateSeoMetadata structured data", () => {
    it("uses WebSite markup when requested for the homepage", () => {
        const data = getStructuredData(
            generateSeoMetadata({ ...baseMetadata, structuredDataType: "WebSite" }),
        );

        expect(data).toMatchObject({
            "@type": "WebSite",
            name: "Example",
            url: "https://example.com/example/",
        });
    });

    it("includes required SocialMediaPosting content and author metadata", () => {
        const data = getStructuredData(
            generateSeoMetadata({
                ...baseMetadata,
                type: "article",
                text: "The full post text.",
                datePublished: new Date("2026-11-17T01:00:00.000Z"),
                author: "Example Author",
                authorUrl: "https://example.com/users/@author/",
            }),
        );

        expect(data).toMatchObject({
            "@type": "SocialMediaPosting",
            text: "The full post text.",
            datePublished: "2026-11-17T01:00:00.000Z",
            author: {
                "@type": "Person",
                name: "Example Author",
                url: "https://example.com/users/@author/",
            },
        });
        expect(data).not.toHaveProperty("headline");
    });

    it("includes ProfilePage mainEntity metadata without inventing an image", () => {
        const data = getStructuredData(
            generateSeoMetadata({
                ...baseMetadata,
                structuredDataType: "ProfilePage",
                profile: {
                    name: "Example Author",
                    url: "https://example.com/users/@author/",
                    identifier: "user-123",
                    alternateName: "author",
                    description: "A public profile.",
                    dateCreated: new Date("2025-01-01T00:00:00.000Z"),
                },
            }),
        );

        expect(data).toMatchObject({
            "@type": "ProfilePage",
            mainEntity: {
                "@type": "Person",
                name: "Example Author",
                url: "https://example.com/users/@author/",
                identifier: "user-123",
                alternateName: "author",
            },
        });
        expect(data).not.toHaveProperty("mainEntity.image");
    });

    it("assigns stable @id values and links related entities", () => {
        const data = getStructuredData(
            generateSeoMetadata({
                ...baseMetadata,
                type: "article",
                author: "Example Author",
                authorUrl: "https://example.com/users/@author/",
            }),
        );

        expect(data["@id"]).toBe("https://example.com/example/#article");
        expect(data).toMatchObject({
            isPartOf: {
                "@id": "https://example.com/#website",
            },
            mainEntityOfPage: {
                "@id": "https://example.com/example/#webpage",
            },
            publisher: {
                "@type": "Organization",
                "@id": "https://example.com/#organization",
            },
            author: {
                "@type": "Person",
                "@id": "https://example.com/users/@author#person",
            },
        });
    });

    it("assigns an @id to ProfilePage and its Person entity", () => {
        const data = getStructuredData(
            generateSeoMetadata({
                ...baseMetadata,
                structuredDataType: "ProfilePage",
                profile: {
                    name: "Example Author",
                    url: "https://example.com/users/@author/",
                    identifier: "user-123",
                },
            }),
        );

        expect(data["@id"]).toBe("https://example.com/example/#profilepage");
        expect(data).toMatchObject({
            mainEntity: {
                "@type": "Person",
                "@id": "https://example.com/users/@author#person",
            },
        });
    });

    it("assigns a stable @id to WebSite", () => {
        const data = getStructuredData(
            generateSeoMetadata({
                ...baseMetadata,
                structuredDataType: "WebSite",
            }),
        );

        expect(data["@id"]).toBe("https://example.com/#website");
    });
});
