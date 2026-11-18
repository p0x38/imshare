import type { ReactNode } from "react";

export interface ContentParserContext {
    content: string;
}

export interface ContentParser {
    id: string;
    name: string;
    version: number;
    render: (context: ContentParserContext) => ReactNode;
}

export type ContentParserRegistry = Map<string, ContentParser>;
