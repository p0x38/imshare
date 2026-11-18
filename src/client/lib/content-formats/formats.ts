export type ContentFormat = "plain" | "markdown" | "wikitext";

export interface ContentFormatCapabilities {
    headingLevels: readonly number[];
    bold: boolean;
    italic: boolean;
    inlineCode: boolean;
    codeBlock: boolean;
    underline: boolean;
    strikethrough: boolean;
    link: boolean;
    linkTitle: boolean;
    blockquote: boolean;
    unorderedList: boolean;
    orderedList: boolean;
    checklist: boolean;
    table: boolean;
}

export interface ContentFormatDefinition {
    value: ContentFormat;
    label: string;
    description: string;
    capabilities: ContentFormatCapabilities;
}

const definitions: Record<ContentFormat, ContentFormatDefinition> = {
    plain: {
        value: "plain",
        label: "Plain text",
        description: "Ordinary text with preserved line breaks.",
        capabilities: {
            headingLevels: [],
            bold: false,
            italic: false,
            inlineCode: false,
            codeBlock: false,
            underline: false,
            strikethrough: false,
            link: false,
            linkTitle: false,
            blockquote: false,
            unorderedList: false,
            orderedList: false,
            checklist: false,
            table: false,
        },
    },
    markdown: {
        value: "markdown",
        label: "Markdown",
        description: "CommonMark with GitHub Flavored Markdown extensions.",
        capabilities: {
            headingLevels: [1, 2, 3, 4, 5, 6],
            bold: true,
            italic: true,
            inlineCode: true,
            codeBlock: true,
            underline: false,
            strikethrough: true,
            link: true,
            linkTitle: true,
            blockquote: true,
            unorderedList: true,
            orderedList: true,
            checklist: true,
            table: true,
        },
    },
    wikitext: {
        value: "wikitext",
        label: "Wikitext",
        description: "The supported MediaWiki-inspired syntax subset.",
        capabilities: {
            headingLevels: [2, 3, 4, 5, 6],
            bold: true,
            italic: true,
            inlineCode: false,
            codeBlock: false,
            underline: false,
            strikethrough: false,
            link: true,
            linkTitle: false,
            blockquote: false,
            unorderedList: true,
            orderedList: true,
            checklist: false,
            table: false,
        },
    },
};

export const CONTENT_FORMATS = [
    definitions.plain,
    definitions.markdown,
    definitions.wikitext,
] as const;

export function isContentFormat(value: unknown): value is ContentFormat {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(definitions, value);
}

export function normalizeContentFormat(value: unknown): ContentFormat {
    return isContentFormat(value) ? value : "plain";
}

export function getContentFormatDefinition(value: unknown): ContentFormatDefinition {
    return definitions[normalizeContentFormat(value)];
}
