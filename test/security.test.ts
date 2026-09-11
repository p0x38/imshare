import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest } from "../src/lib/csrf.js";

test("safe methods do not require an origin", () => {
    assert.equal(isSameOriginRequest("GET", "https://example.com", undefined, undefined), true);
});

test("matching origin is accepted", () => {
    assert.equal(
        isSameOriginRequest("POST", "https://example.com", "https://example.com", undefined),
        true,
    );
});

test("foreign origin is rejected", () => {
    assert.equal(
        isSameOriginRequest("POST", "https://example.com", "https://attacker.example", undefined),
        false,
    );
});

test("referer is used when Origin is absent", () => {
    assert.equal(
        isSameOriginRequest("PATCH", "https://example.com", undefined, "https://example.com/path"),
        true,
    );
});

test("legacy clients without origin metadata remain compatible", () => {
    assert.equal(isSameOriginRequest("POST", "https://example.com", undefined, undefined), true);
});
