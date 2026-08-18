import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AppearancePreferences = {
  themeMode: ThemeMode;
  sidebarMode: "expanded" | "compact" | "collapsed";
  density: "comfortable" | "compact";
  fontFamily: "ibm-plex" | "tajawal" | "noto-arabic" | "inter" | "system";
  fontScale: "small" | "normal" | "large" | "extra_large";
  sidebarFontScale: "small" | "normal" | "large" | "extra_large";
  highContrast: boolean;
  numeralStyle: "western" | "arabic_indic";
  accentColor: "gold" | "blue" | "emerald" | "violet";
  radiusPreset: "soft" | "rounded" | "sharp";
  moduleViewMode: "classic" | "nawa_flow";
};

type ThemeContextType = {
  theme: "light" | "dark";
  preferences: AppearancePreferences;
  updatePreferences: (next: Partial<AppearancePreferences>) => void;
  resetPreferences: () => void;
  toggleTheme: () => void;
  switchable: boolean;
};

const defaultPreferences: AppearancePreferences = { themeMode: "dark", sidebarMode: "expanded", density: "comfortable", fontFamily: "ibm-plex", fontScale: "normal", sidebarFontScale: "normal", highContrast: false, numeralStyle: "western", accentColor: "gold", radiusPreset: "rounded", moduleViewMode: "classic" };
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = "dark" }: { children: React.ReactNode; defaultTheme?: "light" | "dark" }) {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => ({ ...defaultPreferences, themeMode: defaultTheme, ...(JSON.parse(localStorage.getItem("nawa-appearance") || "{}") as Partial<AppearancePreferences>) }));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = preferences.themeMode === "system" ? (systemDark ? "dark" : "light") : preferences.themeMode;
  const updatePreferences = useCallback((next: Partial<AppearancePreferences>) => setPreferences(current => ({ ...current, ...next })), []);
  const resetPreferences = useCallback(() => setPreferences({ ...defaultPreferences, themeMode: defaultTheme }), [defaultTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setSystemDark(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.density = preferences.density;
    root.dataset.font = preferences.fontFamily;
    root.dataset.accent = preferences.accentColor;
    root.dataset.radius = preferences.radiusPreset;
    root.dataset.sidebar = preferences.sidebarMode;
    root.dataset.fontScale = preferences.fontScale;
    root.dataset.sidebarFontScale = preferences.sidebarFontScale;
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.numeralStyle = preferences.numeralStyle;
    localStorage.setItem("nawa-appearance", JSON.stringify(preferences));
    window.dispatchEvent(new Event("nawa-appearance"));
  }, [theme, preferences]);

  const toggleTheme = () => updatePreferences({ themeMode: theme === "dark" ? "light" : "dark" });
  const value = useMemo(() => ({ theme, preferences, updatePreferences, resetPreferences, toggleTheme, switchable: true }), [theme, preferences, updatePreferences, resetPreferences]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
