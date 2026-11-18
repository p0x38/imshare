import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import CodeIcon from "@mui/icons-material/Code";
import DataObjectIcon from "@mui/icons-material/DataObject";
import LinkIcon from "@mui/icons-material/Link";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import ChecklistIcon from "@mui/icons-material/Checklist";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useDeferredValue, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ContentRenderer } from "./ContentRenderer";
import {
    CONTENT_FORMATS,
    getContentFormatDefinition,
    type ContentFormat,
    type ContentFormatCapabilities,
} from "./formats";

type EditorMode = "write" | "split" | "preview";

type ToolbarAction =
    | "bold"
    | "italic"
    | "code"
    | "codeBlock"
    | "underline"
    | "strikethrough"
    | "link"
    | "unorderedList"
    | "orderedList"
    | "quote"
    | "checklist"
    | "table";

type ToolbarCapability = Exclude<keyof ContentFormatCapabilities, "headingLevels" | "linkTitle">;

const toolbarActions = [
    { action: "bold", label: "Bold", Icon: FormatBoldIcon, capability: "bold" },
    { action: "italic", label: "Italic", Icon: FormatItalicIcon, capability: "italic" },
    { action: "code", label: "Inline code", Icon: CodeIcon, capability: "inlineCode" },
    { action: "codeBlock", label: "Code Block", Icon: DataObjectIcon, capability: "codeBlock" },
    {
        action: "underline",
        label: "Underline",
        Icon: FormatUnderlinedIcon,
        capability: "underline",
        workInProgress: true,
    },
    {
        action: "strikethrough",
        label: "Strikethrough",
        Icon: StrikethroughSIcon,
        capability: "strikethrough",
    },
    { action: "link", label: "Link", Icon: LinkIcon, capability: "link" },
    { action: "quote", label: "Blockquote", Icon: FormatQuoteIcon, capability: "blockquote" },
    {
        action: "unorderedList",
        label: "Bulleted list",
        Icon: FormatListBulletedIcon,
        capability: "unorderedList",
    },
    {
        action: "orderedList",
        label: "Numbered list",
        Icon: FormatListNumberedIcon,
        capability: "orderedList",
    },
    {
        action: "checklist",
        label: "Checklist",
        Icon: ChecklistIcon,
        capability: "checklist",
    },
    { action: "table", label: "Table", Icon: TableChartIcon, capability: "table" },
] as const satisfies readonly {
    action: ToolbarAction;
    label: string;
    Icon: typeof FormatBoldIcon;
    capability: ToolbarCapability;
    workInProgress?: boolean;
}[];

interface ContentEditorProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    format: ContentFormat;
    onFormatChange?: (format: ContentFormat) => void;
    showFormatSelector?: boolean;
    required?: boolean;
    minRows?: number;
    maxLength?: number;
    defaultMode?: EditorMode;
}

interface SelectionRange {
    start: number;
    end: number;
}

function escapeMarkdownLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function escapeMarkdownTitle(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function ContentEditor({
    label,
    value,
    onChange,
    format,
    onFormatChange,
    showFormatSelector = true,
    required = true,
    minRows = 12,
    maxLength,
    defaultMode = "split",
}: ContentEditorProps) {
    const id = useId();
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [mode, setMode] = useState<EditorMode>(defaultMode);
    const [headingLevel, setHeadingLevel] = useState(2);

    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkText, setLinkText] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [linkTitle, setLinkTitle] = useState("");
    const [linkError, setLinkError] = useState("");
    const [linkRange, setLinkRange] = useState<SelectionRange>({
        start: 0,
        end: 0,
    });

    const previewContent = useDeferredValue(value);
    const definition = getContentFormatDefinition(format);
    const capabilities = definition.capabilities;

    const headingLabelId = `content-heading-${id}`;
    const formatLabelId = `content-format-${id}`;

    function currentRange(): SelectionRange {
        const input = inputRef.current;

        return {
            start: input?.selectionStart ?? value.length,
            end: input?.selectionEnd ?? value.length,
        };
    }

    function replaceSelection(
        insertion: string,
        range: SelectionRange,
        selectedStart = insertion.length,
        selectedEnd = selectedStart,
    ) {
        onChange(value.slice(0, range.start) + insertion + value.slice(range.end));

        window.requestAnimationFrame(() => {
            const input = inputRef.current;
            if (!input) return;

            input.focus();
            input.setSelectionRange(range.start + selectedStart, range.start + selectedEnd);
        });
    }

    function wrapSelection(prefix: string, suffix: string) {
        const range = currentRange();
        const selected = value.slice(range.start, range.end) || "text";
        const insertion = `${prefix}${selected}${suffix}`;

        replaceSelection(insertion, range, prefix.length, prefix.length + selected.length);
    }

    function applyHeading(level: number) {
        if (!capabilities.headingLevels.includes(level)) return;

        const range = currentRange();
        const selected = value.slice(range.start, range.end) || "Heading";

        const insertion =
            format === "wikitext"
                ? selected
                      .split(/\r?\n/)
                      .map((line) => `${"=".repeat(level)} ${line} ${"=".repeat(level)}`)
                      .join("\n")
                : selected
                      .split(/\r?\n/)
                      .map((line) => `${"#".repeat(level)} ${line}`)
                      .join("\n");

        replaceSelection(insertion, range, 0, insertion.length);
    }

    function applyAction(action: ToolbarAction) {
        if (action === "link" || action === "underline") return;

        const actionCapabilities: Record<
            Exclude<ToolbarAction, "link" | "underline">,
            ToolbarCapability
        > = {
            bold: "bold",
            italic: "italic",
            code: "inlineCode",
            codeBlock: "codeBlock",
            strikethrough: "strikethrough",
            unorderedList: "unorderedList",
            orderedList: "orderedList",
            quote: "blockquote",
            checklist: "checklist",
            table: "table",
        };

        if (!capabilities[actionCapabilities[action]]) return;

        const range = currentRange();
        const selected = value.slice(range.start, range.end);
        let insertion = "";
        let selectedStart = 0;
        let selectedEnd = 0;

        switch (action) {
            case "bold":
                wrapSelection(
                    format === "wikitext" ? "'''" : "**",
                    format === "wikitext" ? "'''" : "**",
                );
                return;

            case "italic":
                wrapSelection(
                    format === "wikitext" ? "''" : "*",
                    format === "wikitext" ? "''" : "*",
                );
                return;

            case "code":
                wrapSelection("`", "`");
                return;

            case "strikethrough":
                wrapSelection("~~", "~~");
                return;

            case "codeBlock": {
                const code = selected || "code";
                const fence = code.includes("```") ? "````" : "```";

                insertion = `${fence}\n${code}\n${fence}`;
                selectedStart = fence.length + 1;
                selectedEnd = selectedStart + code.length;
                break;
            }

            case "unorderedList":
            case "orderedList":
            case "quote":
            case "checklist": {
                const lines = (selected || "Text").split(/\r?\n/);

                insertion = lines
                    .map((line, index) => {
                        if (action === "unorderedList") {
                            return `${format === "wikitext" ? "*" : "-"} ${line}`;
                        }

                        if (action === "orderedList") {
                            return `${format === "wikitext" ? "#" : `${index + 1}.`} ${line}`;
                        }

                        if (action === "checklist") {
                            return `- [ ] ${line}`;
                        }

                        return `> ${line}`;
                    })
                    .join("\n");

                selectedEnd = insertion.length;
                break;
            }

            case "table":
                insertion = [
                    "| Header 1 | Header 2 |",
                    "| --- | --- |",
                    "| Cell 1 | Cell 2 |",
                ].join("\n");

                selectedStart = 2;
                selectedEnd = 10;
                break;
        }

        replaceSelection(insertion, range, selectedStart, selectedEnd);
    }

    function openLinkDialog() {
        const range = currentRange();

        setLinkRange(range);
        setLinkText(value.slice(range.start, range.end));
        setLinkUrl("");
        setLinkTitle("");
        setLinkError("");
        setLinkDialogOpen(true);
    }

    function insertLink() {
        const rawUrl = linkUrl.trim();

        if (!rawUrl) {
            setLinkError("Enter a URL.");
            return;
        }

        if (format === "wikitext" && !/^https?:\/\//i.test(rawUrl)) {
            setLinkError("Wikitext external links require an absolute HTTP(S) URL.");
            return;
        }

        let parsedUrl: URL;

        try {
            parsedUrl = new URL(rawUrl, window.location.origin);
        } catch {
            setLinkError("Enter a valid URL.");
            return;
        }

        const allowedProtocols =
            format === "wikitext" ? ["http:", "https:"] : ["http:", "https:", "mailto:"];

        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            setLinkError("This URL protocol is not supported.");
            return;
        }

        const hasExplicitProtocol = /^[a-z][a-z\d+.-]*:/i.test(rawUrl);

        const destination = hasExplicitProtocol
            ? parsedUrl.href
            : rawUrl.startsWith("//")
              ? `//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
              : `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

        const text = linkText.trim() || rawUrl;

        const insertion =
            format === "wikitext"
                ? `[${destination} ${text.replace(/\]/g, "&#93;")}]`
                : `[${escapeMarkdownLabel(text)}](<${destination}>${
                      linkTitle.trim() ? ` "${escapeMarkdownTitle(linkTitle.trim())}"` : ""
                  })`;

        replaceSelection(insertion, linkRange);
        setLinkDialogOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;

        const key = event.key.toLowerCase();

        if (key === "k" && capabilities.link) {
            event.preventDefault();
            openLinkDialog();
            return;
        }

        if (key === "b" && capabilities.bold) {
            event.preventDefault();
            applyAction("bold");
        }

        if (key === "i" && capabilities.italic) {
            event.preventDefault();
            applyAction("italic");
        }
    }

    return (
        <Stack spacing={1.5}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
            >
                {showFormatSelector ? (
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id={formatLabelId}>Content format</InputLabel>
                        <Select
                            labelId={formatLabelId}
                            value={format}
                            label="Content format"
                            onChange={(event) =>
                                onFormatChange?.(event.target.value as ContentFormat)
                            }
                        >
                            {CONTENT_FORMATS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : (
                    <Typography variant="caption" color="text.secondary">
                        {definition.label}
                    </Typography>
                )}

                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={mode}
                    onChange={(_, next: EditorMode | null) => {
                        if (next) setMode(next);
                    }}
                    aria-label={`${label} editor view`}
                >
                    <ToggleButton value="write">Write</ToggleButton>
                    <ToggleButton value="split">Split</ToggleButton>
                    <ToggleButton value="preview">Preview</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {mode !== "preview" ? (
                <Stack
                    direction="row"
                    spacing={0.25}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    onMouseDown={(event) => {
                        if ((event.target as HTMLElement).closest("button")) {
                            event.preventDefault();
                        }
                    }}
                >
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id={headingLabelId}>Heading</InputLabel>
                        <Select
                            labelId={headingLabelId}
                            value={String(headingLevel)}
                            label="Heading"
                            disabled={capabilities.headingLevels.length === 0}
                            onChange={(event) => {
                                const level = Number(event.target.value);
                                setHeadingLevel(level);
                                applyHeading(level);
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6].map((level) => (
                                <MenuItem
                                    key={level}
                                    value={String(level)}
                                    disabled={!capabilities.headingLevels.includes(level)}
                                >
                                    Heading {level}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {toolbarActions.map((item) => {
                        const { action, label: actionLabel, Icon, capability } = item;
                        const workInProgress =
                            "workInProgress" in item && item.workInProgress === true;

                        const disabled = workInProgress || !capabilities[capability];

                        const tooltip = workInProgress
                            ? `${actionLabel} is a work in progress.`
                            : disabled
                              ? `${actionLabel} is not supported by ${format}.`
                              : actionLabel;

                        return (
                            <Tooltip key={action} title={tooltip}>
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={disabled}
                                        aria-label={actionLabel}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() =>
                                            action === "link"
                                                ? openLinkDialog()
                                                : applyAction(action)
                                        }
                                        sx={{
                                            opacity: disabled ? 0.45 : 1,
                                        }}
                                    >
                                        <Icon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        );
                    })}
                </Stack>
            ) : null}

            <Box
                sx={
                    mode === "split"
                        ? {
                              display: "grid",
                              gridTemplateColumns: {
                                  xs: "minmax(0, 1fr)",
                                  lg: "repeat(2, minmax(0, 1fr))",
                              },
                              gap: 2,
                              alignItems: "start",
                          }
                        : undefined
                }
            >
                {mode !== "preview" ? (
                    <TextField
                        inputRef={inputRef}
                        label={label}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        required={required}
                        fullWidth
                        multiline
                        minRows={minRows}
                        inputProps={maxLength === undefined ? undefined : { maxLength }}
                    />
                ) : null}

                {mode !== "write" ? (
                    <Paper
                        variant="outlined"
                        component="section"
                        aria-label={`${label} preview`}
                        sx={{
                            minWidth: 0,
                            minHeight: 180,
                            p: 2,
                            overflow: "hidden",
                        }}
                    >
                        <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{ display: "block", mb: 1 }}
                        >
                            Preview
                        </Typography>
                        {previewContent.trim() ? (
                            <ContentRenderer content={previewContent} format={format} />
                        ) : (
                            <Typography color="text.secondary">Nothing to preview yet.</Typography>
                        )}
                    </Paper>
                ) : null}
            </Box>

            <Dialog
                open={linkDialogOpen}
                onClose={() => setLinkDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Link settings</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <TextField
                            label="Link text"
                            value={linkText}
                            onChange={(event) => setLinkText(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="URL"
                            value={linkUrl}
                            onChange={(event) => setLinkUrl(event.target.value)}
                            placeholder="https://example.com/"
                            required
                            fullWidth
                        />
                        <TextField
                            label="Link title"
                            value={linkTitle}
                            onChange={(event) => setLinkTitle(event.target.value)}
                            disabled={!capabilities.linkTitle}
                            helperText={
                                capabilities.linkTitle
                                    ? "Optional title shown when hovering over the link."
                                    : "Not supported by the selected format."
                            }
                            fullWidth
                        />
                        <TextField
                            label="Target"
                            value="_blank for external links"
                            disabled
                            helperText="External-link targets are currently managed by ContentRenderer."
                            fullWidth
                        />
                        <TextField
                            label="rel"
                            value="ugc noopener noreferrer"
                            disabled
                            helperText="Security-related rel attributes are managed by ContentRenderer."
                            fullWidth
                        />
                        {linkError ? (
                            <Typography variant="body2" color="error">
                                {linkError}
                            </Typography>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
                    <Button onClick={insertLink} variant="contained">
                        Insert link
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
