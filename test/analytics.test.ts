import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildDailyAnalytics } from "../src/lib/analytics.js";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T11:00:00.000Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

test("buildDailyAnalytics creates an entry for every requested day", () => {
    expect(buildDailyAnalytics(3, [])).toEqual([
        { day: "2026-09-17", values: {} },
        { day: "2026-09-18", values: {} },
        { day: "2026-09-19", values: {} },
    ]);
});

test("buildDailyAnalytics adds matching numeric and bigint metrics", () => {
    expect(
        buildDailyAnalytics(2, [
            { day: "2026-09-18", metric: "views", value: 12 },
            { day: "2026-09-19", metric: "views", value: 34n },
            { day: "2026-09-19", metric: "comments", value: 5n },
        ]),
    ).toEqual([
        { day: "2026-09-18", values: { views: 12 } },
        { day: "2026-09-19", values: { views: 34, comments: 5 } },
    ]);
});

test("buildDailyAnalytics ignores rows outside the requested window", () => {
    expect(
        buildDailyAnalytics(1, [
            { day: "2026-09-18", metric: "views", value: 99 },
            { day: "2026-09-19", metric: "views", value: 7 },
        ]),
    ).toEqual([{ day: "2026-09-19", values: { views: 7 } }]);
});

test("buildDailyAnalytics uses the last value when a metric is repeated for a day", () => {
    expect(
        buildDailyAnalytics(1, [
            { day: "2026-09-19", metric: "views", value: 1 },
            { day: "2026-09-19", metric: "views", value: 2 },
        ]),
    ).toEqual([{ day: "2026-09-19", values: { views: 2 } }]);
});

test("buildDailyAnalytics returns no days for a non-positive range", () => {
    expect(buildDailyAnalytics(0, [])).toEqual([]);
});
