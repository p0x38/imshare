import type { ComponentType } from "react";
import { Box } from "@mui/material";
import { linkifyText } from "../linkify";
import { normalizeContentFormat, type ContentFormat } from "./formats";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { wikitextToMarkdown } from "./wikitext";

interface ContentRendererProps {
    content: string;
    format?: ContentFormat;
    interactive?: boolean;
}

interface FormatRendererProps {
    content: string;
    interactive: boolean;
}

const contentSx = {
    minWidth: 0,
    overflowWrap: "anywhere",
    "& > :first-of-type": {
        mt: 0,
    },
    "& > :last-child": {
        mb: 0,
    },
    "& pre": {
        maxWidth: "100%",
        overflowX: "auto",
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        "& code": {
            p: 0,
            bgcolor: "transparent",
        },
    },
    "& code": {
        px: 0.5,
        py: 0.125,
        borderRadius: 0.5,
        bgcolor: "action.hover",
        fontFamily: "monospace",
        overflowWrap: "anywhere",
    },
    "& img": {
        maxWidth: "100%",
        height: "auto",
    },
    "& p": {
        mt: 0,
        mb: 1.25,
        "&:last-child": {
            mb: 0,
        },
    },
    "& h1, & h2, & h3, & h4, & h5, & h6": {
        lineHeight: 1.3,
        mt: 2,
        mb: 1,
    },
    "& ul, & ol": {
        pl: 3,
    },
    "& blockquote": {
        ml: 0,
        pl: 2,
        borderLeft: 3,
        borderColor: "divider",
        color: "text.secondary",
    },
    "& a": {
        overflowWrap: "anywhere",
    },
    "& table": {
        display: "block",
        maxWidth: "100%",
        overflowX: "auto",
        borderCollapse: "collapse",
    },
    "& th, & td": {
        border: "1px solid",
        borderColor: "divider",
        p: 1,
    },
};

const formatRenderers: Record<ContentFormat, ComponentType<FormatRendererProps>> = {
    plain: ({ content, interactive }) => (
        <Box sx={{ whiteSpace: "pre-wrap" }}>{interactive ? linkifyText(content) : content}</Box>
    ),
    markdown: ({ content, interactive }) => (
        <MarkdownRenderer content={content} interactive={interactive} />
    ),
    wikitext: ({ content, interactive }) => (
        <MarkdownRenderer content={wikitextToMarkdown(content)} interactive={interactive} />
    ),
};

export function ContentRenderer({
    content,
    format = "plain",
    interactive = true,
}: ContentRendererProps) {
    const Renderer = formatRenderers[normalizeContentFormat(format)];

    return (
        <Box sx={contentSx}>
            <Renderer content={content} interactive={interactive} />
        </Box>
    );
}
