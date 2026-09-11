(() => {
    const state = {
        snackbars: [],
    };

    function ensureHost() {
        let host = document.querySelector("#mui-feedback");
        if (!host) {
            host = document.createElement("div");
            host.id = "mui-feedback";
            document.body.append(host);
        }
        return host;
    }

    function showSnackbar(message, severity = "info") {
        const host = ensureHost();
        const snackbar = document.createElement("div");
        snackbar.className = `mui-snackbar mui-snackbar-${severity}`;
        snackbar.setAttribute("role", severity === "error" ? "alert" : "status");
        snackbar.textContent = message;
        host.append(snackbar);
        state.snackbars.push(snackbar);
        window.setTimeout(() => {
            snackbar.remove();
            state.snackbars = state.snackbars.filter((item) => item !== snackbar);
        }, 4000);
        return snackbar;
    }

    async function api(url, options) {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                ...(options?.body && !(options.body instanceof FormData)
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options?.headers ?? {}),
            },
            ...options,
        });
        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { raw: text };
            }
        }
        if (!response.ok) {
            const message = data?.error?.message ?? `Request failed (${response.status}).`;
            throw new Error(message);
        }
        return data;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function setupCopyButtons() {
        document.addEventListener("click", async (event) => {
            const target = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
            if (!target) return;
            const value = target.getAttribute("data-copy");
            if (!value) return;
            try {
                await navigator.clipboard.writeText(value);
                showSnackbar("Copied to clipboard.", "success");
            } catch {
                showSnackbar("Unable to copy to clipboard.", "error");
            }
        });
    }

    setupCopyButtons();

    window.imshareUI = {
        api,
        showSnackbar,
        escapeHtml,
    };
})();
