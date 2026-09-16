import { expect, test } from "vitest";
import { RateLimiter } from "../src/lib/rate-limit.js";

test("rate limiter allows up to the configured limit", () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.consume("client").allowed).toBe(true);
    expect(limiter.consume("client").remaining).toBe(0);
    expect(limiter.consume("client").allowed).toBe(false);
});

test("rate limiter isolates keys", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
});
