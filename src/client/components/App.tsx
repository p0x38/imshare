import { createContext, useContext, useMemo, useState } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { createAppTheme } from "../theme";

type ColorMode = "light" | "dark";

interface ColorModeContextValue {
    mode: ColorMode;
    toggle: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

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
                        "main[id$='-page']": {
                            width: "100%",
                            maxWidth: "none",
                            margin: 0,
                            padding: 0,
                        },
                    }}
                />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}
