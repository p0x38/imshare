import { Box } from "@mui/material";
import { linkifyText } from "../linkify";
import type { ContentFormat } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { wikitextToMarkdown } from "./wikitext";

interface ContentRendererProps {
    content: string;
    format?: ContentFormat;
    interactive?: boolean;
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
    },
    "& img": {
        maxWidth: "100%",
        height: "auto",
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

export function ContentRenderer({
    content,
    format = "plain",
    interactive = true,
}: ContentRendererProps) {
    switch (format) {
        case "plain":
            return (
                <Box sx={{ ...contentSx, whiteSpace: "pre-wrap" }}>
                    {interactive ? linkifyText(content) : content}
                </Box>
            );

        case "markdown":
            return (
                <Box sx={contentSx}>
                    <MarkdownRenderer content={content} interactive={interactive} />
                </Box>
            );

        case "wikitext":
            return (
                <Box sx={contentSx}>
                    <MarkdownRenderer
                        content={wikitextToMarkdown(content)}
                        interactive={interactive}
                    />
                </Box>
            );
    }
}
