export const AVATAR_DECORATION_IDS = [
    "godzilla-dorsal-plates",
    "godzilla-radioactive-glow",
    "april-fools-googly-eyes",
] as const;

export type AvatarDecorationId = (typeof AVATAR_DECORATION_IDS)[number];

export interface AvatarDecorationProps {
    size: number;
}

export type AvatarDecorationSide = "right" | "left";

export type AvatarDecorationSize = "small" | "normal" | "large";

export type AvatarDecorationSettingsMap = {
    "godzilla-dorsal-plates": {
        side: AvatarDecorationSide;
        size: AvatarDecorationSize;
    };
    "godzilla-radioactive-glow": {
        intensity: "subtle" | "normal" | "strong";
        color: "radioactive-green" | "blue" | "purple";
    };
    "april-fools-googly-eyes": {
        size: AvatarDecorationSize;
    };
};

export type AvatarDecorationSettings<K extends AvatarDecorationId> = AvatarDecorationSettingsMap[K];
