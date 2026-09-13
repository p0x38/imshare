import { createContext, useContext, useMemo, useState } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { createAppTheme } from "../theme";

type ColorMode = "light" | "dark";

interface ColorModeContextValue {
    mode: ColorMode;
    toggle: () => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function initialMode(): ColorMode {
    const stored = window.localStorage.getItem("imshare-color-mode");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useColorMode() {
    const context = useContext(ColorModeContext);
    if (!context) throw new Error("useColorMode must be used inside App.");
    return context;
}

export function App({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<ColorMode>(initialMode);
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
    const theme = useMemo(() => createAppTheme(mode), [mode]);

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <GlobalStyles
                    styles={{
                        "@keyframes imshare-ripple": {
                            "0%": { opacity: 0, transform: "scale(0.15)" },
                            "35%": { opacity: 0.2 },
                            "100%": { opacity: 0, transform: "scale(1)" },
                        },
                        "@keyframes imshare-field-error": {
                            "0%": { opacity: 0.72, transform: "translateY(-2px)" },
                            "100%": { opacity: 1, transform: "translateY(0)" },
                        },
                        "@keyframes imshare-helper-error": {
                            "0%": { opacity: 0, transform: "translateY(-4px)" },
                            "100%": { opacity: 1, transform: "translateY(0)" },
                        },
                        "@keyframes imshare-alert-enter": {
                            "0%": { opacity: 0, transform: "translateY(-6px)" },
                            "100%": { opacity: 1, transform: "translateY(0)" },
                        },
                        ".MuiTouchRipple-rippleVisible": {
                            animation: "imshare-ripple 420ms cubic-bezier(0.2, 0, 0, 1) both !important",
                            transformOrigin: "center",
                        },
                        ".MuiTouchRipple-child": {
                            opacity: "1 !important",
                        },
                        ".MuiInputLabel-root": {
                            transition: "color 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 260ms cubic-bezier(0.22, 1, 0.36, 1), font-size 260ms cubic-bezier(0.22, 1, 0.36, 1) !important",
                            willChange: "color, transform, font-size",
                        },
                        ".MuiOutlinedInput-root": {
                            transition: "background-color 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1) !important",
                        },
                        ".MuiOutlinedInput-notchedOutline": {
                            transition: "border-color 220ms cubic-bezier(0.22, 1, 0.36, 1), border-width 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1) !important",
                        },
                        "main:has(> [id$='-page']), main#post": {
                            width: "100% !important",
                            maxWidth: "none !important",
                            margin: "0 !important",
                            padding: "0 !important",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            "*": {
                                animationDuration: "1ms !important",
                                animationIterationCount: "1 !important",
                                transitionDuration: "1ms !important",
                                scrollBehavior: "auto !important",
                            },
                            ".MuiTouchRipple-rippleVisible": {
                                animation: "none !important",
                            },
                            ".MuiInputLabel-root, .MuiOutlinedInput-root, .MuiOutlinedInput-notchedOutline": {
                                transition: "none !important",
                            },
                        },
                    }}
                />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}
