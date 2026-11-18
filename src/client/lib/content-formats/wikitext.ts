export function wikitextToMarkdown(source: string): string {
    const convertedLines = source.split(/\r\n?|\n/).map((line) => {
        const heading = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line);

        if (heading) {
            return `${"#".repeat(heading[1].length)} ${heading[2]}`;
        }

        const unorderedList = /^(\*{1,3})\s+(.+)$/.exec(line);

        if (unorderedList) {
            return `${"  ".repeat(unorderedList[1].length - 1)}- ${unorderedList[2]}`;
        }

        const orderedList = /^(#{1,3})\s+(.+)$/.exec(line);

        if (orderedList) {
            return `${"  ".repeat(orderedList[1].length - 1)}1. ${orderedList[2]}`;
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
