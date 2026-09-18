import { isIP } from "node:net";

export interface ApproxLocation {
    city?: string;
    region?: string;
    country?: string;
    privacyLabels: string[];
}

interface IpInfoResponse {
    city?: unknown;
    region?: unknown;
    country?: unknown;
    anonymous?: {
        is_vpn?: unknown;
        is_proxy?: unknown;
        is_tor?: unknown;
        is_relay?: unknown;
        is_res_proxy?: unknown;
    };
    is_hosting?: unknown;
}

const cache = new Map<string, { expiresAt: number; location: ApproxLocation | null }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;

function isPrivateOrReservedIp(ip: string): boolean {
    const version = isIP(ip);
    if (version === 4) {
        const parts = ip.split(".").map(Number);
        const a = parts[0] ?? 0;
        const b = parts[1] ?? 0;
        return (
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            a >= 224
        );
    }

    if (version === 6) {
        const normalized = ip.toLowerCase();
        return (
            normalized === "::1" ||
            normalized.startsWith("fc") ||
            normalized.startsWith("fd") ||
            normalized.startsWith("fe80:")
        );
    }

    return true;
}

function normalize(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function countryName(code: string | undefined): string | undefined {
    if (!code) return undefined;
    try {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

export async function lookupApproxLocation(
    ip: string | null | undefined,
): Promise<ApproxLocation | null> {
    const normalizedIp = ip?.trim();
    if (!normalizedIp || isPrivateOrReservedIp(normalizedIp)) return null;

    const cached = cache.get(normalizedIp);
    if (cached && cached.expiresAt > Date.now()) return cached.location;

    try {
        const response = await fetch(`https://ipinfo.io/${encodeURIComponent(normalizedIp)}/json`, {
            signal: AbortSignal.timeout(2500),
        });
        if (!response.ok) throw new Error(`IP geolocation request failed: ${response.status}`);

        const data = (await response.json()) as IpInfoResponse;
        const privacyLabels = [
            data.anonymous?.is_vpn === true ? "VPN" : null,
            data.anonymous?.is_proxy === true ? "Proxy" : null,
            data.anonymous?.is_tor === true ? "Tor" : null,
            data.anonymous?.is_relay === true ? "Relay" : null,
            data.anonymous?.is_res_proxy === true ? "Residential proxy" : null,
            data.is_hosting === true ? "Hosting" : null,
        ].filter((label): label is string => label !== null);

        const location =
            normalize(data.city) ||
            normalize(data.region) ||
            normalize(data.country) ||
            privacyLabels.length
                ? {
                      city: normalize(data.city),
                      region: normalize(data.region),
                      country: countryName(normalize(data.country)),
                      privacyLabels,
                  }
                : null;

        cache.set(normalizedIp, { expiresAt: Date.now() + CACHE_TTL_MS, location });
        return location;
    } catch {
        cache.set(normalizedIp, { expiresAt: Date.now() + FAILURE_TTL_MS, location: null });
        return null;
    }
}
