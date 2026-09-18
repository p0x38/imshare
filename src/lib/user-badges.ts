export const MANUAL_BADGE_KEYS = [
    "contributor",
    "verified",
    "early-adopter",
    "bug-hunter",
    "supporter",
] as const;

export type ManualBadgeKey = (typeof MANUAL_BADGE_KEYS)[number];

const MANUAL_BADGE_SET = new Set<string>(MANUAL_BADGE_KEYS);

function parseManualBadges(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) return [];
        return [...new Set(parsed.filter((item): item is string => typeof item === "string" && MANUAL_BADGE_SET.has(item)))];
    } catch {
        return [];
    }
}

function isVeteran(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() >= 365 * 86_400_000;
}

export function userBadges(user: {
    role: string;
    createdAt: Date;
    badgesJson?: string | null;
}): string[] {
    const badges: string[] = [];
    if (user.role === "admin") badges.push("admin");
    if (user.role === "moderator") badges.push("moderator");
    if (isVeteran(user.createdAt)) badges.push("veteran");
    for (const badge of parseManualBadges(user.badgesJson)) {
        if (!badges.includes(badge)) badges.push(badge);
    }
    return badges;
}

export function sanitizeManualBadges(values: unknown): ManualBadgeKey[] {
    if (!Array.isArray(values)) return [];
    return [...new Set(
        values.filter(
            (value): value is ManualBadgeKey =>
                typeof value === "string" && MANUAL_BADGE_SET.has(value),
        ),
    )];
}
