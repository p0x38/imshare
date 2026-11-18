import { describe, expect, it } from "vitest";
import { contentFormatSchema } from "../src/routes/schemas-zod.js";
import { wikitextToMarkdown } from "../src/client/lib/content-formats/wikitext.js";

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
