import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { collection, ok, parseOrder, parsePagination } from "../src/lib/api.js";

test("ok wraps data", () => {
  assert.deepEqual(ok({ id: "post-1" }), { data: { id: "post-1" } });
});

test("collection returns pagination metadata", () => {
  assert.deepEqual(collection([1, 2], 2, 2, 5), {
    data: [1, 2],
    pagination: {
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    },
  });
});

test("parsePagination clamps invalid values", () => {
  assert.deepEqual(parsePagination({ page: "0", limit: "999" }), {
    page: 1,
    limit: 100,
    skip: 0,
  });
});

test("parseOrder defaults to descending", () => {
  assert.equal(parseOrder(undefined), "desc");
  assert.equal(parseOrder("asc"), "asc");
  assert.equal(parseOrder("invalid"), "desc");
});

test("health and version routes are publicly available", async () => {
  const app = await buildApp();
  try {
    const health = await app.inject({ method: "GET", url: "/v1/health" });
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: "ok" });

    const version = await app.inject({ method: "GET", url: "/v1/version" });
    assert.equal(version.statusCode, 200);
    assert.deepEqual(version.json(), { data: { api: "v1", version: "1.0.0" } });
  } finally {
    await app.close();
  }
});
