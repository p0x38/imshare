const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string): string | null {
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

export function isSafeMethod(method: string): boolean {
    return SAFE_METHODS.has(method.toUpperCase());
}

export function isSameOriginRequest(
    method: string,
    configuredOrigin: string,
    originHeader: string | undefined,
    refererHeader: string | undefined,
): boolean {
    if (isSafeMethod(method)) return true;

    const expected = normalizeOrigin(configuredOrigin);
    if (!expected) return false;

    const origin = originHeader?.trim();
    if (origin) return normalizeOrigin(origin) === expected;

    const referer = refererHeader?.trim();
    if (referer) return normalizeOrigin(referer) === expected;

    return true;
}
