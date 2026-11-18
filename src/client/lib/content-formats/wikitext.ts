export function wikitextToMarkdown(source: string): string {
    const convertedLines = source.split(/\r\n?|\n/).map((line) => {
        const heading = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line);

        if (heading) {
            const [, level, title] = heading;

            if (level !== undefined && title !== undefined) {
                return `${"#".repeat(level.length)} ${title}`;
            }
        }

        const unorderedList = /^(\*{1,3})\s+(.+)$/.exec(line);

        if (unorderedList) {
            const [, level, content] = unorderedList;

            if (level !== undefined && content !== undefined) {
                return `${"  ".repeat(level.length - 1)}- ${content}`;
            }
        }

        const orderedList = /^(#{1,3})\s+(.+)$/.exec(line);

        if (orderedList) {
            const [, level, content] = orderedList;

            if (level !== undefined && content !== undefined) {
                return `${"  ".repeat(level.length - 1)}1. ${content}`;
            }
        }

        return line;
    });

    return convertedLines
        .join("\n")
        .replace(/'''(.*?)'''/g, "**$1**")
        .replace(/''(.*?)''/g, "*$1*")
        .replace(
            /\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g,
            (_match, url: string, label?: string) => `[${label ?? url}](${url})`,
        );
}
