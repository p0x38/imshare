import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { createAppTheme, type AccentColor, type ThemeSettings } from "../theme";
import i18n from "../i18n";

type ColorModePreference = "light" | "dark" | "auto";
type ColorMode = "light" | "dark";
export type Language = "en" | "ja";
type ColorModeContextValue = { mode: ColorMode; preference: ColorModePreference; setPreference: (preference: ColorModePreference) => void; toggle: () => void; };
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; };
type ThemeSettingsContextValue = { settings: ThemeSettings; setAnimations: (enabled: boolean) => void; setRipple: (enabled: boolean) => void; setAccentColor: (color: AccentColor) => void; };
export const ColorModeContext = createContext<ColorModeContextValue | null>(null);
export const LanguageContext = createContext<LanguageContextValue | null>(null);
export const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);
function getDeviceMode(): ColorMode { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
function initialColorModePreference(): ColorModePreference { const stored = window.localStorage.getItem("imshare-color-mode"); return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto"; }
function initialLanguage(): Language { const stored = window.localStorage.getItem("imshare-language"); return stored === "en" || stored === "ja" ? stored : "en"; }
function initialThemeSettings(): ThemeSettings { try { const stored = window.localStorage.getItem("imshare-theme-settings"); if (!stored) return { animations: false, ripple: false, accentColor: "default" }; const parsed = JSON.parse(stored) as Partial<ThemeSettings>; const accentColor: AccentColor = parsed.accentColor === "blue" || parsed.accentColor === "purple" || parsed.accentColor === "green" || parsed.accentColor === "orange" ? parsed.accentColor : "default"; return { animations: parsed.animations === true, ripple: parsed.ripple === true, accentColor }; } catch { return { animations: false, ripple: false, accentColor: "default" }; } }
export function useColorMode() { const context = useContext(ColorModeContext); if (!context) throw new Error("useColorMode must be used inside App."); return context; }
export function useLanguage() { const context = useContext(LanguageContext); if (!context) throw new Error("useLanguage must be used inside App."); return context; }
export function useThemeSettings() { const context = useContext(ThemeSettingsContext); if (!context) throw new Error("useThemeSettings must be used inside App."); return context; }
export function App({ children }: { children: React.ReactNode }) {
    const [preference, setPreferenceState] = useState<ColorModePreference>(initialColorModePreference);
    const [deviceMode, setDeviceMode] = useState<ColorMode>(getDeviceMode);
    const [language, setLanguageState] = useState<Language>(initialLanguage);
    const [settings, setSettings] = useState<ThemeSettings>(initialThemeSettings);
    useEffect(() => { const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)"); const handleChange = () => setDeviceMode(mediaQuery.matches ? "dark" : "light"); handleChange(); mediaQuery.addEventListener("change", handleChange); return () => mediaQuery.removeEventListener("change", handleChange); }, []);
    useEffect(() => { document.documentElement.lang = language; }, [language]);
    useEffect(() => { const loading = document.getElementById("app-loading"); if (!loading) return; loading.setAttribute("aria-busy", "false"); loading.remove(); }, []);
    const mode: ColorMode = preference === "auto" ? deviceMode : preference;
    const setPreference = (next: ColorModePreference) => { setPreferenceState(next); window.localStorage.setItem("imshare-color-mode", next); };
    const setLanguage = (next: Language) => { setLanguageState(next); window.localStorage.setItem("imshare-language", next); void i18n.changeLanguage(next); };
    const colorMode = useMemo(() => ({ mode, preference, setPreference, toggle: () => setPreference(mode === "light" ? "dark" : "light") }), [mode, preference]);
    const languageContext = useMemo(() => ({ language, setLanguage }), [language]);
    const updateSettings = (update: Partial<ThemeSettings>) => setSettings((current) => { const next = { ...current, ...update }; window.localStorage.setItem("imshare-theme-settings", JSON.stringify(next)); return next; });
    const themeSettings = useMemo(() => ({ settings, setAnimations: (enabled: boolean) => updateSettings({ animations: enabled }), setRipple: (enabled: boolean) => updateSettings({ ripple: enabled }), setAccentColor: (accentColor: AccentColor) => updateSettings({ accentColor }) }), [settings]);
    const theme = useMemo(() => createAppTheme(mode, settings), [mode, settings]);
    return <ColorModeContext.Provider value={colorMode}><LanguageContext.Provider value={languageContext}><ThemeSettingsContext.Provider value={themeSettings}><ThemeProvider theme={theme}><CssBaseline /><GlobalStyles styles={{ "main:has(> [id$='-page']), main#post": { width: "100% !important", maxWidth: "none !important", margin: "0 !important", padding: "0 !important" } }} />{children}</ThemeProvider></ThemeSettingsContext.Provider></LanguageContext.Provider></ColorModeContext.Provider>;
}
