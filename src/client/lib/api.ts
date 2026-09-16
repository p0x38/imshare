export interface ApiOptions extends RequestInit {
    body?: BodyInit | null;
}

function apiUrl(url: string): string {
    if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url)) return url;
    if (!url.startsWith("/v1/")) return url;
    return `/api${url}`;
}

function normalizeResponseUrls(value: unknown, key?: string): unknown {
    if (typeof value === "string" && (key === "url" || key === "avatarUrl") && value.startsWith("/v1/")) {
        return `/api${value}`;
    }
    if (Array.isArray(value)) return value.map((item) => normalizeResponseUrls(item));
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, normalizeResponseUrls(entryValue, entryKey)]));
    }
    return value;
}

// The upload editor uses XMLHttpRequest directly so it can report upload
// progress. Normalize its relative API URLs just like the fetch helper does.
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    const resolvedUrl = typeof url === "string" ? apiUrl(url) : url;
    return originalOpen.call(this, method, resolvedUrl, ...rest);
};

export async function api<T = any>(url: string, options?: ApiOptions): Promise<T> {
    const response = await fetch(apiUrl(url), {
        headers: {
            Accept: "application/json",
            ...(options?.body && !(options.body instanceof FormData)
                ? { "Content-Type": "application/json" }
                : {}),
            ...(options?.headers ?? {}),
        },
        ...options,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message =
            typeof payload === "object" && payload !== null && "error" in payload
                ? String((payload as { error?: { message?: string } }).error?.message ?? "Request failed.")
                : typeof payload === "string" && payload
                  ? payload
                  : "Request failed.";
        const error = new Error(message) as Error & { status?: number; data?: unknown };
        error.status = response.status;
        error.data = payload;
        throw error;
    }

    return normalizeResponseUrls(payload) as T;
}
