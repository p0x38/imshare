import type { ContentParser, ContentParserRegistry } from "./types.js";

const parsers: ContentParserRegistry = new Map();

export function registerContentParser(parser: ContentParser): void {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(parser.id)) {
        throw new Error(`Invalid content parser ID: ${parser.id}`);
    }

    if (parsers.has(parser.id)) {
        throw new Error(`Content parser already registered: ${parser.id}`);
    }

    parsers.set(parser.id, parser);
}

export function getContentParser(id: string): ContentParser | undefined {
    return parsers.get(id);
}

export function getContentParsers(): ContentParser[] {
    return [...parsers.values()];
}
