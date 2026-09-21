import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type PostGridDensity = "compact" | "comfortable" | "spacious";

export const POST_GRID_DENSITY_STORAGE_KEY = "imshare.postGridDensity";

export const postGridDensitySettings: Record<
    PostGridDensity,
    {
        columns: number;
        itemLimit: number;
        gap: { xs: number; sm: number };
    }
> = {
    compact: { columns: 6, itemLimit: 36, gap: { xs: 0.75, sm: 1.25 } },
    comfortable: { columns: 4, itemLimit: 16, gap: { xs: 1, sm: 2 } },
    spacious: { columns: 3, itemLimit: 9, gap: { xs: 1.5, sm: 2.5 } },
};

function isPostGridDensity(value: string | null): value is PostGridDensity {
    return value === "compact" || value === "comfortable" || value === "spacious";
}

function readDensity(storageKey: string): PostGridDensity {
    if (typeof window === "undefined") return "comfortable";
    const value = window.localStorage.getItem(storageKey);
    return isPostGridDensity(value) ? value : "comfortable";
}

export function usePostGridDensity(
    storageKey = POST_GRID_DENSITY_STORAGE_KEY,
): {
    density: PostGridDensity;
    setDensity: (density: PostGridDensity) => void;
} {
    const [density, setDensityState] = useState<PostGridDensity>(() => readDensity(storageKey));

    useEffect(() => {
        setDensityState(readDensity(storageKey));
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) setDensityState(readDensity(storageKey));
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [storageKey]);

    const setDensity = useCallback(
        (value: PostGridDensity) => {
            setDensityState(value);
            if (typeof window !== "undefined") window.localStorage.setItem(storageKey, value);
        },
        [storageKey],
    );

    return { density, setDensity };
}

export function getPostGridItemLimit(density: PostGridDensity): number {
    return postGridDensitySettings[density].itemLimit;
}

export function PostGridDensityControl({
    density,
    onChange,
}: {
    density: PostGridDensity;
    onChange: (density: PostGridDensity) => void;
}) {
    const { t } = useTranslation();

    return (
        <ToggleButtonGroup
            size="small"
            exclusive
            value={density}
            onChange={(_, value: PostGridDensity | null) => {
                if (value) onChange(value);
            }}
            aria-label={t("postsPage.gridDensity")}
        >
            <ToggleButton value="compact">{t("postsPage.sixBySix")}</ToggleButton>
            <ToggleButton value="comfortable">{t("postsPage.fourByFour")}</ToggleButton>
            <ToggleButton value="spacious">{t("postsPage.threeByThree")}</ToggleButton>
        </ToggleButtonGroup>
    );
}
