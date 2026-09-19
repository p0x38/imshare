import { describe, expect, test } from "vitest";
import {
    deserializePermissions,
    generateApiToken,
    hashApiToken,
    parsePermissions,
    permissionsAllow,
    serializePermissions,
    validateTokenName,
} from "../src/lib/api-tokens.js";

describe("API token helpers", () => {
    test("generates a prefixed token and only stores its hash", () => {
        const generated = generateApiToken();
        expect(generated.token).toMatch(/^ims_[A-Za-z0-9_-]+$/);
        expect(generated.prefix).toBe(generated.token.slice(0, 12));
        expect(generated.hash).toBe(hashApiToken(generated.token));
        expect(generated.hash).not.toBe(generated.token);
    });

    test("permission parsing normalizes supported actions", () => {
        expect(parsePermissions({
            posts: ["read", "read", "write", "invalid"],
            uploads: ["write"],
        })).toEqual({
            posts: ["read", "write"],
            uploads: ["write"],
        });
    });

    test("permission matching supports resource and wildcard grants", () => {
        const permissions = { posts: ["read"] as const, "*": ["delete"] as const };
        expect(permissionsAllow(permissions, "posts", "read")).toBe(true);
        expect(permissionsAllow(permissions, "uploads", "read")).toBe(false);
        expect(permissionsAllow(permissions, "uploads", "delete")).toBe(true);
    });

    test("permission serialization round-trips", () => {
        const permissions = { posts: ["read", "write"] as const };
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
});
