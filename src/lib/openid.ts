import { genericOAuth } from "better-auth/plugins";

interface OpenIdConfig {
    providerId: string;
    clientId: string;
    clientSecret?: string;
    discoveryUrl: string;
    scopes: string[];
}

function optional(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value || undefined;
}

export function loadOpenIdConfig(): OpenIdConfig | null {
    const providerId = optional("OIDC_PROVIDER_ID");
    const clientId = optional("OIDC_CLIENT_ID");
    const discoveryUrl = optional("OIDC_DISCOVERY_URL");
    const clientSecret = optional("OIDC_CLIENT_SECRET");

    if (!providerId && !clientId && !discoveryUrl && !clientSecret) return null;
    if (!providerId || !clientId || !discoveryUrl) {
        throw new Error(
            "OIDC_PROVIDER_ID, OIDC_CLIENT_ID, and OIDC_DISCOVERY_URL must be configured together.",
        );
    }

    return {
        providerId,
        clientId,
        ...(clientSecret ? { clientSecret } : {}),
        discoveryUrl,
        scopes: ["openid", "email", "profile"],
    };
}

export function createOpenIdPlugin() {
    const config = loadOpenIdConfig();
    if (!config) return null;

    return genericOAuth({
        config: [config],
    });
}

export function getOpenIdProviderId(): string | null {
    return loadOpenIdConfig()?.providerId ?? null;
}
