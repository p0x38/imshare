import { describe, expect, it } from "vitest";
import { getSeasonalEvent } from "../src/lib/seasonal-events.js";

describe("getSeasonalEvent", () => {
    it("activates Godzilla Day on November 3", () => {
        expect(getSeasonalEvent(new Date(2026, 10, 3))?.id).toBe("godzilla-day");
    });

    it("activates April Fools' Day on April 1", () => {
        expect(getSeasonalEvent(new Date(2026, 3, 1))?.id).toBe("april-fools");
    });

    it("returns undefined on ordinary days", () => {
        expect(getSeasonalEvent(new Date(2026, 5, 15))).toBeUndefined();
    });
});
