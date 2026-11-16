import { afterEach, describe, expect, it, vi } from "vitest";
import {
    getDefaultSeasonalEventConfigs,
    getSeasonalEvent,
    getSeasonalEventConfigs,
    getSeasonalEventOverride,
    resetSeasonalEventConfig,
    resetSeasonalEventConfigs,
    seasonalEvents,
    setSeasonalEventConfigs,
    setSeasonalEventOverride,
    type SeasonalEventConfig,
} from "../src/lib/seasonal-events.js";

function installStorage(): Storage {
    const values = new Map<string, string>();
    const storage: Storage = {
        get length() {
            return values.size;
        },
        clear() {
            values.clear();
        },
        getItem(key) {
            return values.get(key) ?? null;
        },
        key(index) {
            return [...values.keys()][index] ?? null;
        },
        removeItem(key) {
            values.delete(key);
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
    };

    vi.stubGlobal("window", { localStorage: storage });
    return storage;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("getSeasonalEvent", () => {
    it("activates Godzilla Day throughout its inclusive date range", () => {
        expect(getSeasonalEvent(new Date(2026, 10, 1))?.id).toBe("godzilla-day");
        expect(getSeasonalEvent(new Date(2026, 10, 3))?.id).toBe("godzilla-day");
        expect(getSeasonalEvent(new Date(2026, 10, 5))?.id).toBe("godzilla-day");
    });

    it("does not activate outside an event's date range", () => {
        expect(getSeasonalEvent(new Date(2026, 9, 31))).toBeUndefined();
        expect(getSeasonalEvent(new Date(2026, 10, 6))).toBeUndefined();
    });

    it("activates April Fools' Day on April 1", () => {
        expect(getSeasonalEvent(new Date(2026, 3, 1))?.id).toBe("april-fools");
    });

    it("returns undefined on ordinary days", () => {
        expect(getSeasonalEvent(new Date(2026, 5, 15))).toBeUndefined();
    });

    it("supports date ranges that cross December and January", () => {
        const configs = getDefaultSeasonalEventConfigs().map((event) =>
            event.id === "godzilla-day"
                ? {
                      ...event,
                      ranges: [
                          {
                              start: { month: 12, day: 30 },
                              end: { month: 1, day: 3 },
                          },
                      ],
                  }
                : event,
        );

        expect(getSeasonalEvent(new Date(2026, 11, 30), "automatic", configs)?.id).toBe(
            "godzilla-day",
        );
        expect(getSeasonalEvent(new Date(2027, 0, 3), "automatic", configs)?.id).toBe(
            "godzilla-day",
        );
        expect(getSeasonalEvent(new Date(2027, 0, 4), "automatic", configs)).toBeUndefined();
    });

    it("allows February 29 ranges and skips the missing day in non-leap years", () => {
        const configs = getDefaultSeasonalEventConfigs().map((event) =>
            event.id === "godzilla-day"
                ? {
                      ...event,
                      ranges: [
                          {
                              start: { month: 2, day: 29 },
                              end: { month: 3, day: 2 },
                          },
                      ],
                  }
                : event,
        );

        expect(getSeasonalEvent(new Date(2024, 1, 29), "automatic", configs)?.id).toBe(
            "godzilla-day",
        );
        expect(getSeasonalEvent(new Date(2025, 2, 1), "automatic", configs)?.id).toBe(
            "godzilla-day",
        );
        expect(getSeasonalEvent(new Date(2025, 1, 28), "automatic", configs)).toBeUndefined();
    });

    it("uses the highest priority when event ranges overlap", () => {
        const configs = getDefaultSeasonalEventConfigs().map((event) => ({
            ...event,
            ranges: [{ start: { month: 4, day: 1 }, end: { month: 4, day: 1 } }],
            priority: event.id === "godzilla-day" ? 20 : 10,
        }));

        expect(getSeasonalEvent(new Date(2026, 3, 1), "automatic", configs)?.id).toBe(
            "godzilla-day",
        );
    });

    it("keeps the first configured event when priorities tie", () => {
        const configs = getDefaultSeasonalEventConfigs().map((event) => ({
            ...event,
            ranges: [{ start: { month: 4, day: 1 }, end: { month: 4, day: 1 } }],
            priority: 10,
        }));

        expect(getSeasonalEvent(new Date(2026, 3, 1), "automatic", configs)?.id).toBe(
            seasonalEvents[0]?.id,
        );
    });

    it("does not automatically activate disabled events", () => {
        const configs = getDefaultSeasonalEventConfigs().map((event) => ({
            ...event,
            enabled: false,
        }));

        expect(getSeasonalEvent(new Date(2026, 10, 3), "automatic", configs)).toBeUndefined();
    });

    it("forces a disabled event for manual preview", () => {
        const configs = getDefaultSeasonalEventConfigs().map((event) => ({
            ...event,
            enabled: false,
        }));

        expect(getSeasonalEvent(new Date(2026, 5, 15), "godzilla-day", configs)?.id).toBe(
            "godzilla-day",
        );
    });

    it("forces April Fools regardless of date", () => {
        expect(getSeasonalEvent(new Date(2026, 5, 15), "april-fools")?.id).toBe("april-fools");
    });

    it("disables seasonal events when overridden with none", () => {
        expect(getSeasonalEvent(new Date(2026, 10, 3), "none")).toBeUndefined();
    });

    it("returns undefined for an invalid Date in automatic mode", () => {
        expect(getSeasonalEvent(new Date(Number.NaN))).toBeUndefined();
    });
});

describe("seasonal event configuration storage", () => {
    it("returns default configurations when no customization is stored", () => {
        installStorage();
        expect(getSeasonalEventConfigs()).toEqual(getDefaultSeasonalEventConfigs());
    });

    it("persists customized configurations", () => {
        installStorage();
        const configs = getDefaultSeasonalEventConfigs().map((event) =>
            event.id === "godzilla-day"
                ? { ...event, name: "My Godzilla Event", priority: 25 }
                : event,
        );

        expect(setSeasonalEventConfigs(configs)).toBe(true);
        expect(getSeasonalEventConfigs()).toEqual(configs);
    });

    it("rejects invalid dates, priorities, duplicate IDs, and unknown events", () => {
        installStorage();
        const defaults = getDefaultSeasonalEventConfigs();
        const invalidDate = defaults.map((event) =>
            event.id === "godzilla-day"
                ? {
                      ...event,
                      ranges: [
                          {
                              start: { month: 2, day: 30 },
                              end: { month: 3, day: 2 },
                          },
                      ],
                  }
                : event,
        );
        const invalidPriority = defaults.map((event) => ({ ...event, priority: 1001 }));

        expect(setSeasonalEventConfigs(invalidDate)).toBe(false);
        expect(setSeasonalEventConfigs(invalidPriority)).toBe(false);
        expect(setSeasonalEventConfigs([defaults[0]!, defaults[0]!])).toBe(false);
        const unknownEvent = defaults.map((event, index) =>
            index === 0
                ? ({
                      ...event,
                      id: "unknown-event",
                  } as unknown as SeasonalEventConfig)
                : event,
        );
        expect(setSeasonalEventConfigs(unknownEvent)).toBe(false);
    });

    it("falls back to defaults when stored JSON is malformed", () => {
        const storage = installStorage();
        storage.setItem("imshare-seasonal-event-configs", "{");
        expect(getSeasonalEventConfigs()).toEqual(getDefaultSeasonalEventConfigs());
    });

    it("resets one event without changing other customized events", () => {
        installStorage();
        const configs = getDefaultSeasonalEventConfigs().map((event) => ({
            ...event,
            name: `${event.name} Custom`,
        }));

        expect(setSeasonalEventConfigs(configs)).toBe(true);
        expect(resetSeasonalEventConfig("godzilla-day")).toBe(true);
        expect(getSeasonalEventConfigs().find((event) => event.id === "godzilla-day")?.name).toBe(
            "Godzilla Day",
        );
        expect(getSeasonalEventConfigs().find((event) => event.id === "april-fools")?.name).toBe(
            "April Fools' Day Custom",
        );
    });

    it("resets all customized configurations without clearing the preview override", () => {
        installStorage();
        const configs = getDefaultSeasonalEventConfigs().map((event) => ({
            ...event,
            name: `${event.name} Custom`,
        }));

        expect(setSeasonalEventConfigs(configs)).toBe(true);
        expect(setSeasonalEventOverride("none")).toBe(true);
        expect(resetSeasonalEventConfigs()).toBe(true);
        expect(getSeasonalEventConfigs()).toEqual(getDefaultSeasonalEventConfigs());
        expect(getSeasonalEventOverride()).toBe("none");
    });
});

describe("seasonal event preview override storage", () => {
    it("persists and clears a preview override", () => {
        installStorage();

        expect(setSeasonalEventOverride("godzilla-day")).toBe(true);
        expect(getSeasonalEventOverride()).toBe("godzilla-day");
        expect(setSeasonalEventOverride("automatic")).toBe(true);
        expect(getSeasonalEventOverride()).toBe("automatic");
    });

    it("uses automatic behavior when browser storage is unavailable", () => {
        vi.stubGlobal(
            "window",
            Object.defineProperty({}, "localStorage", {
                get() {
                    throw new Error("Storage is blocked");
                },
            }),
        );

        expect(getSeasonalEventOverride()).toBe("automatic");
        expect(getSeasonalEventConfigs()).toEqual(getDefaultSeasonalEventConfigs());
        expect(setSeasonalEventOverride("none")).toBe(false);
        expect(setSeasonalEventConfigs(getDefaultSeasonalEventConfigs())).toBe(false);
    });
});
