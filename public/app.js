export async function api(path, options = {}) {
    const response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers: { Accept: "application/json", ...(options.headers || {}) },
    });
    let body = null;
    try {
        body = await response.json();
    } catch {}
    if (!response.ok) {
        const error = new Error(body?.error?.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.body = body;
        throw error;
    }
    return body;
}

export function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
}

export function imageUrl(upload, width = 1200) {
    return `${upload.url}?width=${width}&format=webp`;
}

export function showSnackbar(message, severity = "info") {
    const existing = document.querySelector(".mui-snackbar");
    existing?.remove();
    const snackbar = document.createElement("div");
    snackbar.className = `mui-snackbar mui-snackbar-${severity}`;
    snackbar.setAttribute("role", severity === "error" ? "alert" : "status");
    snackbar.textContent = String(message);
    document.body.append(snackbar);
    requestAnimationFrame(() => snackbar.classList.add("mui-snackbar-visible"));
    window.setTimeout(() => {
        snackbar.classList.remove("mui-snackbar-visible");
        window.setTimeout(() => snackbar.remove(), 200);
    }, 4000);
}
