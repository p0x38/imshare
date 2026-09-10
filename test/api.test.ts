import assert from "node:assert/strict";
import test from "node:test";

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
