import { describe, expect, it } from "vitest";
import { contentFormatSchema } from "../src/routes/schemas-zod.js";
import {
    CONTENT_FORMATS,
    isContentFormat,
    normalizeContentFormat,
    getContentFormatDefinition,
} from "../src/client/lib/content-formats/formats.js";
import { wikitextToMarkdown } from "../src/client/lib/content-formats/wikitext.js";

describe("content format registry", () => {
    it("matches the formats accepted by the API", () => {
        const formats = CONTENT_FORMATS.map(({ value }) => value);

        expect(formats).toEqual(["plain", "markdown", "wikitext"]);

        for (const format of formats) {
            expect(isContentFormat(format)).toBe(true);
            expect(contentFormatSchema.safeParse(format).success).toBe(true);
        }
    });

    it("rejects unsupported formats and normalizes unknown values to plain text", () => {
        expect(isContentFormat("tiptap")).toBe(false);
        expect(isContentFormat("html")).toBe(false);
        expect(normalizeContentFormat("tiptap")).toBe("plain");
        expect(normalizeContentFormat(undefined)).toBe("plain");
    });
});

describe("contentFormatSchema", () => {
    it.each(["plain", "markdown", "wikitext"])("accepts %s", (format) => {
        expect(contentFormatSchema.safeParse(format).success).toBe(true);
    });

    it.each(["html", "tiptap", "unknown", ""])("rejects unsupported format %s", (format) => {
        expect(contentFormatSchema.safeParse(format).success).toBe(false);
    });
});

describe("wikitextToMarkdown", () => {
    it("converts headings and inline formatting", () => {
        expect(wikitextToMarkdown("== Heading ==\n'''bold''' and ''italic''")).toBe(
            "## Heading\n**bold** and *italic*",
        );
    });

    it("converts unordered and ordered lists", () => {
        expect(wikitextToMarkdown("* First\n* Second\n# Third")).toBe(
            "- First\n- Second\n1. Third",
        );
    });

    it("converts external links", () => {
        expect(wikitextToMarkdown("[https://example.com Example]")).toBe(
            "[Example](https://example.com)",
        );
    });

    it("leaves unrecognized internal links as text", () => {
        expect(wikitextToMarkdown("[[Example page]]")).toBe("[[Example page]]");
    });
});

describe("content format capabilities", () => {
    it("enables GFM features for Markdown", () => {
        const { capabilities } = getContentFormatDefinition("markdown");

        expect(capabilities.headingLevels).toEqual([1, 2, 3, 4, 5, 6]);
        expect(capabilities.codeBlock).toBe(true);
        expect(capabilities.strikethrough).toBe(true);
        expect(capabilities.checklist).toBe(true);
        expect(capabilities.table).toBe(true);
        expect(capabilities.underline).toBe(false);
    });

    it("only enables implemented Wikitext features", () => {
        const { capabilities } = getContentFormatDefinition("wikitext");

        expect(capabilities.headingLevels).toEqual([2, 3, 4, 5, 6]);
        expect(capabilities.bold).toBe(true);
        expect(capabilities.italic).toBe(true);
        expect(capabilities.link).toBe(true);
        expect(capabilities.codeBlock).toBe(false);
        expect(capabilities.table).toBe(false);
        expect(capabilities.checklist).toBe(false);
        expect(capabilities.underline).toBe(false);
    });

    it("keeps formatting unavailable for Plain text", () => {
        const { capabilities } = getContentFormatDefinition("plain");

        expect(capabilities.headingLevels).toEqual([]);
        expect(capabilities.bold).toBe(false);
        expect(capabilities.link).toBe(false);
        expect(capabilities.table).toBe(false);
    });
});
