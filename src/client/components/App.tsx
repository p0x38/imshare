import { createContext, useContext, useMemo, useState } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { createAppTheme, type AccentColor, type ThemeSettings } from "../theme";

type ColorMode = "light" | "dark";

const defaultThemeSettings: ThemeSettings = {
    animations: false,
    ripple: false,
    accentColor: "default",
};

interface ColorModeContextValue {
    mode: ColorMode;
    toggle: () => void;
}

interface ThemeSettingsContextValue {
    settings: ThemeSettings;
    setAnimations: (enabled: boolean) => void;
    setRipple: (enabled: boolean) => void;
    setAccentColor: (color: AccentColor) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null);
export const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

function initialMode(): ColorMode {
    const stored = window.localStorage.getItem("imshare-color-mode");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialThemeSettings(): ThemeSettings {
    try {
        const stored = window.localStorage.getItem("imshare-theme-settings");
        if (!stored) return defaultThemeSettings;
        const parsed = JSON.parse(stored) as Partial<ThemeSettings>;
        const accentColor: AccentColor =
            parsed.accentColor === "blue" || parsed.accentColor === "purple" || parsed.accentColor === "green" || parsed.accentColor === "orange"
                ? parsed.accentColor
                : "default";
        return {
            animations: parsed.animations === true,
            ripple: parsed.ripple === true,
            accentColor,
        };
    } catch {
        return defaultThemeSettings;
    }
}

export function useColorMode() {
    const context = useContext(ColorModeContext);
    if (!context) throw new Error("useColorMode must be used inside App.");
    return context;
}

export function useThemeSettings() {
    const context = useContext(ThemeSettingsContext);
    if (!context) throw new Error("useThemeSettings must be used inside App.");
    return context;
}

export function App({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<ColorMode>(initialMode);
    const [settings, setSettings] = useState<ThemeSettings>(initialThemeSettings);

    const colorMode = useMemo(
        () => ({
            mode,
            toggle: () => {
                setMode((current) => {
                    const next = current === "light" ? "dark" : "light";
                    window.localStorage.setItem("imshare-color-mode", next);
                    return next;
                });
            },
        }),
        [mode],
    );

    const updateSettings = (update: Partial<ThemeSettings>) => {
        setSettings((current) => {
            const next = { ...current, ...update };
            window.localStorage.setItem("imshare-theme-settings", JSON.stringify(next));
            return next;
        });
    };

    const themeSettings = useMemo(
        () => ({
            settings,
            setAnimations: (enabled: boolean) => updateSettings({ animations: enabled }),
            setRipple: (enabled: boolean) => updateSettings({ ripple: enabled }),
            setAccentColor: (accentColor: AccentColor) => updateSettings({ accentColor }),
        }),
        [settings],
    );
    const theme = useMemo(() => createAppTheme(mode, settings), [mode, settings]);

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeSettingsContext.Provider value={themeSettings}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <GlobalStyles
                        styles={{
                            "main:has(> [id$='-page']), main#post": {
                                width: "100% !important",
                                maxWidth: "none !important",
                                margin: "0 !important",
                                padding: "0 !important",
                            },
                        }}
                    />
                    {children}
                </ThemeProvider>
            </ThemeSettingsContext.Provider>
        </ColorModeContext.Provider>
    );
}
