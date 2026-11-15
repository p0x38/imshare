import { describe, expect, test } from "vitest";
import {
    deserializePermissions,
    generateApiToken,
    hashApiToken,
    parseApiTokenExpiry,
    parsePermissions,
    permissionsAllow,
    serializePermissions,
    validateTokenName,
    type ApiTokenPermissions,
} from "../src/lib/api-tokens.js";

describe("API token helpers", () => {
    describe("expiration parsing", () => {
        const now = new Date("2026-01-01T00:00:00.000Z");

        test("accepts a future ISO date-time", () => {
            expect(parseApiTokenExpiry("2026-01-08T00:00:00.000Z", now)).toEqual(
                new Date("2026-01-08T00:00:00.000Z"),
            );
        });

        test("accepts null and empty expiration values", () => {
            expect(parseApiTokenExpiry(null, now)).toBeNull();
            expect(parseApiTokenExpiry("", now)).toBeNull();
        });

        test("rejects missing, invalid, and non-string values", () => {
            expect(parseApiTokenExpiry(undefined, now)).toBeUndefined();
            expect(parseApiTokenExpiry(123, now)).toBeUndefined();
            expect(parseApiTokenExpiry("not-a-date", now)).toBeUndefined();
        });

        test("rejects past and current expiration dates", () => {
            expect(parseApiTokenExpiry("2025-12-31T23:59:59.999Z", now)).toBeUndefined();
            expect(parseApiTokenExpiry("2026-01-01T00:00:00.000Z", now)).toBeUndefined();
        });
    });

    test("generates a prefixed token and only stores its hash", () => {
        const generated = generateApiToken();

        expect(generated.token).toMatch(/^ims_[A-Za-z0-9_-]+$/);
        expect(generated.prefix).toBe(generated.token.slice(0, 12));
        expect(generated.hash).toBe(hashApiToken(generated.token));
        expect(generated.hash).not.toBe(generated.token);
    });

    test("permission parsing normalizes supported actions", () => {
        expect(
            parsePermissions({
                posts: ["read", "read", "write", "invalid"],
                uploads: ["write"],
            }),
        ).toEqual({
            posts: ["read", "write"],
            uploads: ["write"],
        });
    });

    test("permission matching supports resource and wildcard grants", () => {
        const permissions: ApiTokenPermissions = {
            posts: ["read"],
            "*": ["delete"],
        };

        expect(permissionsAllow(permissions, "posts", "read")).toBe(true);
        expect(permissionsAllow(permissions, "uploads", "read")).toBe(false);
        expect(permissionsAllow(permissions, "uploads", "delete")).toBe(true);
    });

    test("permission serialization round-trips", () => {
        const permissions: ApiTokenPermissions = {
            posts: ["read", "write"],
        };

        expect(deserializePermissions(serializePermissions(permissions))).toEqual(permissions);
    });

    test("invalid permission payloads are rejected", () => {
        expect(parsePermissions(null)).toBeNull();
        expect(parsePermissions([])).toBeNull();
        expect(parsePermissions({ posts: "read" })).toBeNull();
    });

    test("token names are trimmed and length-limited", () => {
        expect(validateTokenName("  My CLI  ")).toBe("My CLI");
        expect(validateTokenName("")).toBeNull();
        expect(validateTokenName("x".repeat(101))).toBeNull();
    });

    test("rejects prototype-sensitive permission names", () => {
        expect(parsePermissions(JSON.parse('{"__proto__":["read"]}'))).toBeNull();
        expect(parsePermissions(JSON.parse('{"constructor":["read"]}'))).toBeNull();
        expect(parsePermissions(JSON.parse('{"prototype":["read"]}'))).toBeNull();
    });
});
