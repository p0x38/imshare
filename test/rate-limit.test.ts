import assert from "node:assert/strict";
import test from "node:test";
import { RateLimiter } from "../src/lib/rate-limit.js";

test("rate limiter allows up to the configured limit", () => {
    const limiter = new RateLimiter(2, 60_000);
    assert.equal(limiter.consume("client").allowed, true);
    assert.equal(limiter.consume("client").remaining, 0);
    assert.equal(limiter.consume("client").allowed, false);
});

test("rate limiter isolates keys", () => {
    const limiter = new RateLimiter(1, 60_000);
    assert.equal(limiter.consume("a").allowed, true);
    assert.equal(limiter.consume("a").allowed, false);
    assert.equal(limiter.consume("b").allowed, true);
});
