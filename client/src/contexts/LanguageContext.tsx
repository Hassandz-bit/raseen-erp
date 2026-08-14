import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getDirection, type AppLanguage, translations, type TranslationKey } from "@/i18n/translations";

type LanguageContextValue = {
  language: AppLanguage;
  direction: "rtl" | "ltr";
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const languageLocale: Record<AppLanguage, string> = { ar: "ar-DZ", fr: "fr-FR", en: "en-US" };
const isSupportedLanguage = (value: string | null): value is AppLanguage => value === "ar" || value === "fr" || value === "en";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const preview = new URLSearchParams(window.location.search).get("lang");
    return isSupportedLanguage(preview) ? preview : (localStorage.getItem("nawa-language") as AppLanguage) || "ar";
  });
  const direction = getDirection(language);
  const setLanguage = useCallback((next: AppLanguage) => setLanguageState(next), []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    localStorage.setItem("nawa-language", language);
  }, [language, direction]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    direction,
    setLanguage,
    t: key => translations[language][key] ?? translations.en[key],
    formatDate: (value, options) => new Intl.DateTimeFormat(languageLocale[language], options ?? { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)),
    formatNumber: (value, options) => new Intl.NumberFormat(languageLocale[language], options).format(value),
  }), [language, direction]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
