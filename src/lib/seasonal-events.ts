export type SeasonalEventId = "godzilla-day" | "april-fools";
export type SeasonalEventOverride = "automatic" | "none" | SeasonalEventId;

export interface SeasonalDate {
    month: number;
    day: number;
}

export interface SeasonalDateRange {
    start: SeasonalDate;
    end: SeasonalDate;
}

export interface SeasonalEventConfig {
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    ranges: SeasonalDateRange[];
}

const STORAGE_KEY = "imshare-seasonal-event-override";

export const seasonalEvents: readonly SeasonalEventConfig[] = [
    {
        id: "godzilla-day",
        name: "Godzilla Day",
        enabled: true,
        priority: 10,
        ranges: [
            {
                start: { month: 11, day: 1 },
                end: { month: 11, day: 5 },
            },
        ],
    },
    {
        id: "april-fools",
        name: "April Fools' Day",
        enabled: true,
        priority: 10,
        ranges: [
            {
                start: { month: 4, day: 1 },
                end: { month: 4, day: 1 },
            },
        ],
    },
];

export function getSeasonalEventOverride(): SeasonalEventOverride {
    if (typeof window === "undefined") return "automatic";

    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === "none" || seasonalEvents.some((event) => event.id === stored)) {
        return stored as SeasonalEventOverride;
    }

    return "automatic";
}

export function setSeasonalEventOverride(value: SeasonalEventOverride): void {
    if (typeof window === "undefined") return;

    if (value === "automatic") {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
    }

    window.localStorage.setItem(STORAGE_KEY, value);
}

function isValidDate({ month, day }: SeasonalDate, year: number): boolean {
    if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (month < 1 || month > 12 || day < 1) return false;

    const date = new Date(year, month, 0);
    return day <= date.getDate();
}

function dateValue({ month, day }: SeasonalDate): number {
    return month * 100 + day;
}

function isDateInRange(date: Date, range: SeasonalDateRange): boolean {
    const current = dateValue({
        month: date.getMonth() + 1,
        day: date.getDate(),
    });

    const start = dateValue(range.start);
    const end = dateValue(range.end);

    if (start <= end) {
        return current >= start && current <= end;
    }

    // Supports ranges crossing December and January.
    return current >= start || current <= end;
}

function isEventActive(event: SeasonalEventConfig, date: Date): boolean {
    const year = date.getFullYear();

    return (
        event.enabled &&
        event.ranges.some(
            (range) =>
                isValidDate(range.start, year) &&
                isValidDate(range.end, year) &&
                isDateInRange(date, range),
        )
    );
}

export function getSeasonalEvent(
    date = new Date(),
    override = getSeasonalEventOverride(),
): SeasonalEventConfig | undefined {
    if (override === "none") return undefined;

    if (override !== "automatic") {
        return seasonalEvents.find((event) => event.id === override);
    }

    return seasonalEvents
        .filter((event) => isEventActive(event, date))
        .sort((a, b) => b.priority - a.priority)[0];
}
