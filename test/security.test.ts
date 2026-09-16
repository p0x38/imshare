import { expect, test } from "vitest";
import { isSameOriginRequest } from "../src/lib/csrf.js";

test("safe methods do not require an origin", () => {
    expect(isSameOriginRequest("GET", "https://example.com", undefined, undefined)).toBe(true);
});

test("matching origin is accepted", () => {
    expect(
        isSameOriginRequest("POST", "https://example.com", "https://example.com", undefined),
    ).toBe(true);
});

test("foreign origin is rejected", () => {
    expect(
        isSameOriginRequest("POST", "https://example.com", "https://attacker.example", undefined),
    ).toBe(false);
});

test("referer is used when Origin is absent", () => {
    expect(
        isSameOriginRequest("PATCH", "https://example.com", undefined, "https://example.com/path"),
    ).toBe(true);
});

test("legacy clients without origin metadata remain compatible", () => {
    expect(isSameOriginRequest("POST", "https://example.com", undefined, undefined)).toBe(true);
});
