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
    id: SeasonalEventId;
    name: string;
    enabled: boolean;
    priority: number;
    ranges: SeasonalDateRange[];
}

export const MAX_SEASONAL_EVENT_NAME_LENGTH = 80;
export const MAX_SEASONAL_EVENT_PRIORITY = 1000;
export const MAX_SEASONAL_EVENT_RANGES = 20;

const OVERRIDE_STORAGE_KEY = "imshare-seasonal-event-override";
const CONFIG_STORAGE_KEY = "imshare-seasonal-event-configs";

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

function getStorage(): Storage | undefined {
    if (typeof window === "undefined") return undefined;

    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeasonalEventId(value: unknown): value is SeasonalEventId {
    return seasonalEvents.some((event) => event.id === value);
}

function cloneEventConfig(event: SeasonalEventConfig): SeasonalEventConfig {
    return {
        ...event,
        ranges: event.ranges.map((range) => ({
            start: { ...range.start },
            end: { ...range.end },
        })),
    };
}

function isValidSeasonalDate(value: unknown): value is SeasonalDate {
    if (!isRecord(value)) return false;

    const { month, day } = value;
    if (typeof month !== "number" || !Number.isInteger(month)) return false;
    if (typeof day !== "number" || !Number.isInteger(day)) return false;
    if (month < 1 || month > 12 || day < 1) return false;

    // 2000 is a leap year, so February 29 remains a valid recurring date.
    const daysInMonth = new Date(2000, month, 0).getDate();
    return day <= daysInMonth;
}

function normalizeEventConfig(
    value: unknown,
    fallback: SeasonalEventConfig,
): SeasonalEventConfig | undefined {
    if (!isRecord(value) || value.id !== fallback.id) return undefined;
    if (typeof value.name !== "string") return undefined;
    if (!value.name.trim() || value.name.length > MAX_SEASONAL_EVENT_NAME_LENGTH) return undefined;
    if (typeof value.enabled !== "boolean") return undefined;
    const priority = value.priority;
    if (
        typeof priority !== "number" ||
        !Number.isInteger(priority) ||
        priority < 0 ||
        priority > MAX_SEASONAL_EVENT_PRIORITY
    ) {
        return undefined;
    }
    if (
        !Array.isArray(value.ranges) ||
        value.ranges.length > MAX_SEASONAL_EVENT_RANGES
    ) {
        return undefined;
    }

    const ranges: SeasonalDateRange[] = [];

    for (const range of value.ranges) {
        if (!isRecord(range)) return undefined;
        const start = range.start;
        const end = range.end;
        if (!isValidSeasonalDate(start) || !isValidSeasonalDate(end)) {
            return undefined;
        }

        ranges.push({
            start: { month: start.month, day: start.day },
            end: { month: end.month, day: end.day },
        });
    }

    return {
        id: fallback.id,
        name: value.name.trim(),
        enabled: value.enabled,
        priority,
        ranges,
    };
}

export function getDefaultSeasonalEventConfigs(): SeasonalEventConfig[] {
    return seasonalEvents.map(cloneEventConfig);
}

export function getSeasonalEventConfigs(): SeasonalEventConfig[] {
    const storage = getStorage();
    if (!storage) return getDefaultSeasonalEventConfigs();

    try {
        const stored = storage.getItem(CONFIG_STORAGE_KEY);
        if (!stored) return getDefaultSeasonalEventConfigs();

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return getDefaultSeasonalEventConfigs();

        const storedById = new Map<string, unknown>();
        for (const value of parsed) {
            if (isRecord(value) && typeof value.id === "string") {
                storedById.set(value.id, value);
            }
        }

        return seasonalEvents.map((fallback) => {
            const normalized = normalizeEventConfig(storedById.get(fallback.id), fallback);
            return normalized ?? cloneEventConfig(fallback);
        });
    } catch {
        return getDefaultSeasonalEventConfigs();
    }
}

export function setSeasonalEventConfigs(configs: readonly SeasonalEventConfig[]): boolean {
    const storage = getStorage();
    if (!storage || !Array.isArray(configs) || configs.length !== seasonalEvents.length) {
        return false;
    }

    const configsById = new Map<SeasonalEventId, unknown>();

    for (const config of configs as readonly unknown[]) {
        if (!isRecord(config) || !isSeasonalEventId(config.id) || configsById.has(config.id)) {
            return false;
        }

        configsById.set(config.id, config);
    }

    const normalized: SeasonalEventConfig[] = [];

    for (const fallback of seasonalEvents) {
        const config = normalizeEventConfig(configsById.get(fallback.id), fallback);
        if (!config) return false;
        normalized.push(config);
    }

    try {
        storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
        return true;
    } catch {
        return false;
    }
}

export function resetSeasonalEventConfig(id: SeasonalEventId): boolean {
    const fallback = getDefaultSeasonalEventConfigs().find((event) => event.id === id);
    if (!fallback) return false;

    const next = getSeasonalEventConfigs().map((event) =>
        event.id === id ? fallback : event,
    );
    return setSeasonalEventConfigs(next);
}

export function resetSeasonalEventConfigs(): boolean {
    const storage = getStorage();
    if (!storage) return false;

    try {
        storage.removeItem(CONFIG_STORAGE_KEY);
        return true;
    } catch {
        return false;
    }
}

export function getSeasonalEventOverride(): SeasonalEventOverride {
    const storage = getStorage();
    if (!storage) return "automatic";

    try {
        const stored = storage.getItem(OVERRIDE_STORAGE_KEY);

        if (stored === "none" || isSeasonalEventId(stored)) {
            return stored;
        }
    } catch {
        // Fall back to the automatic schedule if browser storage is unavailable.
    }

    return "automatic";
}

export function setSeasonalEventOverride(value: SeasonalEventOverride): boolean {
    const storage = getStorage();
    if (!storage) return false;
    if (value !== "automatic" && value !== "none" && !isSeasonalEventId(value)) return false;

    try {
        if (value === "automatic") {
            storage.removeItem(OVERRIDE_STORAGE_KEY);
        } else {
            storage.setItem(OVERRIDE_STORAGE_KEY, value);
        }

        return true;
    } catch {
        return false;
    }
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

    // A start date after the end date represents a range crossing New Year.
    return current >= start || current <= end;
}

function isEventActive(event: SeasonalEventConfig, date: Date): boolean {
    return (
        event.enabled &&
        event.ranges.some(
            (range) =>
                isValidSeasonalDate(range.start) &&
                isValidSeasonalDate(range.end) &&
                isDateInRange(date, range),
        )
    );
}

export function getSeasonalEvent(
    date = new Date(),
    override = getSeasonalEventOverride(),
    configs: readonly SeasonalEventConfig[] = getSeasonalEventConfigs(),
): SeasonalEventConfig | undefined {
    if (override === "none") return undefined;

    if (override !== "automatic") {
        // Explicit preview overrides intentionally ignore the event's enabled flag and schedule.
        return configs.find((event) => event.id === override);
    }

    if (Number.isNaN(date.getTime())) return undefined;

    return configs.reduce<SeasonalEventConfig | undefined>((winner, event) => {
        if (!isEventActive(event, date)) return winner;
        if (!winner || event.priority > winner.priority) return event;
        return winner;
    }, undefined);
}
