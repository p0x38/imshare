export const USER_ROLES = ["user", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
const ROLE_RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };
export function isUserRole(value: unknown): value is UserRole {
    return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
export function roleRank(role: string): number {
    return isUserRole(role) ? ROLE_RANK[role] : -1;
}
export function hasRole(actualRole: string, requiredRole: UserRole): boolean {
    return roleRank(actualRole) >= ROLE_RANK[requiredRole];
}
export function canModerateTarget(actorRole: string, targetRole: string): boolean {
    return (
        actorRole === "admin" ||
        (actorRole === "moderator" && roleRank(targetRole) < ROLE_RANK.moderator)
    );
}
