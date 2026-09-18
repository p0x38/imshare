import { afterEach, expect, test } from "vitest";
import { getPublicConfig, resolveBaseUrl } from "../src/lib/config.js";

const originalProviderId = process.env.OIDC_PROVIDER_ID;
const originalClientId = process.env.OIDC_CLIENT_ID;
const originalDiscoveryUrl = process.env.OIDC_DISCOVERY_URL;
const originalClientSecret = process.env.OIDC_CLIENT_SECRET;

const baseConfig = {
    server: { host: "127.0.0.1", port: 5454 },
    storage: { uploadDirectory: "uploads", maxFileSize: 25 * 1024 * 1024 },
    site: { name: "imshare-test", version: "1.0.0" },
    auth: {
        baseUrl: "https://example.com/",
        trustedOrigins: [],
        emailAndPasswordEnabled: true,
        registration: { enabled: true, public: false },
    },
};

function restoreOidcEnvironment(): void {
    for (const key of [
        "OIDC_PROVIDER_ID",
        "OIDC_CLIENT_ID",
        "OIDC_DISCOVERY_URL",
        "OIDC_CLIENT_SECRET",
    ])
        delete process.env[key];
    if (originalProviderId !== undefined) process.env.OIDC_PROVIDER_ID = originalProviderId;
    if (originalClientId !== undefined) process.env.OIDC_CLIENT_ID = originalClientId;
    if (originalDiscoveryUrl !== undefined) process.env.OIDC_DISCOVERY_URL = originalDiscoveryUrl;
    if (originalClientSecret !== undefined) process.env.OIDC_CLIENT_SECRET = originalClientSecret;
}

afterEach(restoreOidcEnvironment);

test("public config reports token requirement for private registration", () => {
    restoreOidcEnvironment();
    const config = getPublicConfig(baseConfig);

    expect(config.auth.emailAndPasswordEnabled).toBe(true);
    expect(config.auth.registration).toEqual({
        enabled: true,
        public: false,
        tokenRequired: true,
        approvalRequired: false,
    });
    expect(config.auth.oidcProviderId).toBeNull();
});

test("public config does not require a token for public registration", () => {
    restoreOidcEnvironment();
    const config = getPublicConfig({
        ...baseConfig,
        auth: {
            ...baseConfig.auth,
            registration: { enabled: true, public: true },
        },
    });

    expect(config.auth.registration.tokenRequired).toBe(false);
});

test("public config exposes only the OIDC provider id", () => {
    restoreOidcEnvironment();
    process.env.OIDC_PROVIDER_ID = "test-provider";
    process.env.OIDC_CLIENT_ID = "secret-client-id";
    process.env.OIDC_DISCOVERY_URL = "https://issuer.example/.well-known/openid-configuration";
    process.env.OIDC_CLIENT_SECRET = "secret-client-secret";

    const config = getPublicConfig(baseConfig);
    expect(config.auth.oidcProviderId).toBe("test-provider");
    expect(JSON.stringify(config)).not.toContain("secret-client-id");
    expect(JSON.stringify(config)).not.toContain("secret-client-secret");
    expect(JSON.stringify(config)).not.toContain("openid-configuration");
});

test("resolveBaseUrl uses the configured explicit port", () => {
    expect(
        resolveBaseUrl({
            ...baseConfig,
            server: { host: "127.0.0.1", port: 5454 },
            auth: { ...baseConfig.auth, baseUrl: "https://example.com:8443/" },
        }),
    ).toBe("https://example.com:8443");
});

test("resolveBaseUrl adds the configured server port when absent", () => {
    expect(
        resolveBaseUrl({
            ...baseConfig,
            server: { host: "127.0.0.1", port: 5454 },
            auth: { ...baseConfig.auth, baseUrl: "https://example.com" },
        }),
    ).toBe("https://example.com:5454");
});

test("resolveBaseUrl derives a URL when no base URL is configured", () => {
    expect(
        resolveBaseUrl({
            ...baseConfig,
            server: { host: "127.0.0.1", port: 5454 },
            auth: { ...baseConfig.auth, baseUrl: undefined },
        }),
    ).toBe("http://127.0.0.1:5454");
});
