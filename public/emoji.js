export function renderEmojiText(value, emojis) {
    const escaped = String(value ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
    );
    return escaped.replace(/:([a-z0-9_+-]{1,32}):/g, (match, name) => {
        const emoji = emojis.get(name);
        if (!emoji) return match;
        const url = String(emoji.url).replace(
            /[&<>"']/g,
            (c) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
        );
        return `<img class="custom-emoji" src="${url}" alt=":${name}:" title=":${name}:" loading="lazy" decoding="async">`;
    });
}

export async function loadEmojiCatalog() {
    try {
        const response = await fetch("/v1/emojis");
        if (!response.ok) return new Map();
        const payload = await response.json();
        return new Map((payload.data ?? []).map((emoji) => [emoji.name, emoji]));
    } catch {
        return new Map();
    }
}
