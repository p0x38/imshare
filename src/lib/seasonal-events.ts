export type SeasonalEventId = "godzilla-day" | "april-fools";

export interface SeasonalEvent {
    id: SeasonalEventId;
    name: string;
    month: number;
    day: number;
}

export const seasonalEvents: readonly SeasonalEvent[] = [
    {
        id: "godzilla-day",
        name: "Godzilla Day",
        month: 11,
        day: 3,
    },
    {
        id: "april-fools",
        name: "April Fools' Day",
        month: 4,
        day: 1,
    },
];

export function getSeasonalEvent(date = new Date()): SeasonalEvent | undefined {
    return seasonalEvents.find(
        (event) => event.month === date.getMonth() + 1 && event.day === date.getDate(),
    );
}
