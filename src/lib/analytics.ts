export interface DailyAnalyticsPoint {
    day: string;
    values: Record<string, number>;
}

export interface DailyAnalyticsRow {
    day: string;
    metric: string;
    value: number | bigint;
}

export function buildDailyAnalytics(days: number, rows: DailyAnalyticsRow[]): DailyAnalyticsPoint[] {
    const byDay = new Map<string, Record<string, number>>();
    const today = new Date();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date(
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset),
        );
        byDay.set(date.toISOString().slice(0, 10), {});
    }

    for (const row of rows) {
        const values = byDay.get(row.day);
        if (!values) continue;
        values[row.metric] = Number(row.value);
    }

    return [...byDay.entries()].map(([day, values]) => ({ day, values }));
}
