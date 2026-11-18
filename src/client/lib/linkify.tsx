import type { ReactNode } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}]$/;

export function linkifyText(value: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let cursor = 0;

    for (const match of value.matchAll(URL_PATTERN)) {
        const raw = match[0];
        const start = match.index;

        let visibleUrl = raw;

        while (TRAILING_PUNCTUATION.test(visibleUrl)) {
            visibleUrl = visibleUrl.slice(0, -1);
        }

        if (!visibleUrl) continue;

        const href = visibleUrl.startsWith("www.") ? `https://${visibleUrl}` : visibleUrl;

        let validUrl: URL;

        try {
            validUrl = new URL(href);
        } catch {
            continue;
        }

        if (validUrl.protocol !== "http:" && validUrl.protocol !== "https:") {
            continue;
        }

        if (start > cursor) {
            nodes.push(value.slice(cursor, start));
        }

        nodes.push(
            <a
                key={`${start}-${visibleUrl}`}
                href={validUrl.href}
                target="_blank"
                rel="ugc noopener noreferrer"
            >
                {visibleUrl}
            </a>,
        );

        const punctuation = raw.slice(visibleUrl.length);

        if (punctuation) {
            nodes.push(punctuation);
        }

        cursor = start + raw.length;
    }

    if (cursor < value.length) {
        nodes.push(value.slice(cursor));
    }

    return nodes.length ? nodes : [value];
}
