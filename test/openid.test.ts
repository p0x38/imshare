import { afterEach, expect, test } from "vitest";
import { getOpenIdProviderId, loadOpenIdConfig } from "../src/lib/openid.js";

const oidcKeys = [
    "OIDC_PROVIDER_ID",
    "OIDC_CLIENT_ID",
    "OIDC_DISCOVERY_URL",
    "OIDC_CLIENT_SECRET",
] as const;

const savedEnvironment = Object.fromEntries(
    oidcKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof oidcKeys)[number], string | undefined>;

function clearOidcEnvironment(): void {
    for (const key of oidcKeys) delete process.env[key];
}

afterEach(() => {
    clearOidcEnvironment();
    for (const key of oidcKeys) {
        const value = savedEnvironment[key];
        if (value !== undefined) process.env[key] = value;
    }
});

test("OpenID Connect is disabled when no OIDC variables are configured", () => {
    clearOidcEnvironment();
    expect(loadOpenIdConfig()).toBeNull();
    expect(getOpenIdProviderId()).toBeNull();
});

test("OpenID Connect loads the required discovery configuration", () => {
    clearOidcEnvironment();
    process.env.OIDC_PROVIDER_ID = "test-provider";
    process.env.OIDC_CLIENT_ID = "test-client";
    process.env.OIDC_DISCOVERY_URL = "https://issuer.example/.well-known/openid-configuration";

    expect(loadOpenIdConfig()).toEqual({
        providerId: "test-provider",
        clientId: "test-client",
        discoveryUrl: "https://issuer.example/.well-known/openid-configuration",
        scopes: ["openid", "email", "profile"],
    });
    expect(getOpenIdProviderId()).toBe("test-provider");
});

test("OpenID Connect includes a configured client secret", () => {
    clearOidcEnvironment();
    process.env.OIDC_PROVIDER_ID = "test-provider";
    process.env.OIDC_CLIENT_ID = "test-client";
    process.env.OIDC_DISCOVERY_URL = "https://issuer.example/.well-known/openid-configuration";
    process.env.OIDC_CLIENT_SECRET = "test-secret";

    expect(loadOpenIdConfig()).toMatchObject({
        providerId: "test-provider",
        clientId: "test-client",
        clientSecret: "test-secret",
    });
});

test("partial OpenID Connect configuration fails clearly", () => {
    clearOidcEnvironment();
    process.env.OIDC_PROVIDER_ID = "test-provider";
    process.env.OIDC_CLIENT_ID = "test-client";

    expect(() => loadOpenIdConfig()).toThrow(
        "OIDC_PROVIDER_ID, OIDC_CLIENT_ID, and OIDC_DISCOVERY_URL must be configured together.",
    );
});

test("blank OpenID Connect values are treated as unset", () => {
    clearOidcEnvironment();
    process.env.OIDC_PROVIDER_ID = "  ";
    process.env.OIDC_CLIENT_ID = "  ";
    process.env.OIDC_DISCOVERY_URL = "  ";
    process.env.OIDC_CLIENT_SECRET = "  ";

    expect(loadOpenIdConfig()).toBeNull();
});
