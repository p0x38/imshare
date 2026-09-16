export function renderErrorPage(status: number, title: string, message: string): string {
    const escape = (value: string) =>
        value.replace(
            /[&<>"']/g,
            (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character,
        );

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#1976d2" />
    <title>${escape(title)} · imshare</title>
</head>
<body data-status="${status}" data-title="${escape(title)}" data-message="${escape(message)}">
    <div id="error-page"></div>
    <script type="module" src="/client/error.js"></script>
</body>
</html>`;
}
