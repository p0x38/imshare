import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { collection, ok, parseOrder, parsePagination } from "../src/lib/api.js";

test("ok wraps data", () => assert.deepEqual(ok({ id: "post-1" }), { data: { id: "post-1" } }));
test("collection returns pagination metadata", () => assert.deepEqual(collection([1, 2], 2, 2, 5), { data: [1, 2], pagination: { page: 2, limit: 2, total: 5, totalPages: 3 } }));
test("parsePagination clamps invalid values", () => assert.deepEqual(parsePagination({ page: "0", limit: "999" }), { page: 1, limit: 100, skip: 0 }));
test("parseOrder defaults to descending", () => { assert.equal(parseOrder(undefined), "desc"); assert.equal(parseOrder("asc"), "asc"); assert.equal(parseOrder("invalid"), "desc"); });

test("health and version routes are publicly available", async () => {
  const app = await buildApp();
  try { const health = await app.inject({ method: "GET", url: "/v1/health" }); assert.equal(health.statusCode, 200); assert.deepEqual(health.json(), { status: "ok" }); const version = await app.inject({ method: "GET", url: "/v1/version" }); assert.equal(version.statusCode, 200); assert.deepEqual(version.json(), { data: { api: "v1", version: "1.0.0" } }); }
  finally { await app.close(); }
});

test("protected social routes require authentication", async () => {
  const app = await buildApp();
  try {
    for (const url of ["/v1/me/notifications", "/v1/me/notifications/unread-count", "/v1/posts/missing/comments"]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 401, url);
    }
  } finally { await app.close(); }
});

test("image route rejects invalid transformation parameters", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/v1/posts/image/missing?width=1" });
    assert.equal(response.statusCode, 404);
  } finally { await app.close(); }
});

test("request schemas reject malformed post and user bodies", async () => {
  const app = await buildApp();
  try {
    const post = await app.inject({ method: "POST", url: "/v1/posts", payload: { title: "", unexpected: true } }); assert.equal(post.statusCode, 400);
    const user = await app.inject({ method: "POST", url: "/v1/users", payload: { name: "test" } }); assert.equal(user.statusCode, 400);
  } finally { await app.close(); }
});
