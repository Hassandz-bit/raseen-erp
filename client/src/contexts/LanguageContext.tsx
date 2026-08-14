import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getDirection, type AppLanguage, translations, type TranslationKey } from "@/i18n/translations";
import { formatOrganizationCurrency, formatOrganizationDate, formatOrganizationNumber, formatOrganizationTime, type OrganizationFormatSettings } from "@/lib/formatting";

type LanguageContextValue = {
  language: AppLanguage;
  direction: "rtl" | "ltr";
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number) => string;
  formatTime: (value: Date | string | number) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const languageLocale: Record<AppLanguage, string> = { ar: "ar-DZ", fr: "fr-FR", en: "en-US" };
const isSupportedLanguage = (value: string | null): value is AppLanguage => value === "ar" || value === "fr" || value === "en";
const defaultOrganizationFormat: OrganizationFormatSettings = { currencyCode: "DZD", currencySymbolPosition: "after", decimalPlaces: 2, dateFormat: "DD/MM/YYYY", timeFormat: "24h", timeZone: "Africa/Algiers", decimalSeparator: "dot", thousandsSeparator: "comma", numeralStyle: "western" };
function getOrganizationFormat() { try { const organization = JSON.parse(localStorage.getItem("nawa-organization-format") || "{}") as Partial<OrganizationFormatSettings>; const appearance = JSON.parse(localStorage.getItem("nawa-appearance") || "{}") as { numeralStyle?: OrganizationFormatSettings["numeralStyle"] }; return { ...defaultOrganizationFormat, ...organization, numeralStyle: appearance.numeralStyle ?? organization.numeralStyle ?? "western" }; } catch { return defaultOrganizationFormat; } }

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const preview = new URLSearchParams(window.location.search).get("lang");
    return isSupportedLanguage(preview) ? preview : (localStorage.getItem("nawa-language") as AppLanguage) || "ar";
  });
  const direction = getDirection(language);
  const [organizationFormat, setOrganizationFormat] = useState<OrganizationFormatSettings>(getOrganizationFormat);
  const setLanguage = useCallback((next: AppLanguage) => setLanguageState(next), []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    localStorage.setItem("nawa-language", language);
  }, [language, direction]);
  useEffect(() => {
    const sync = () => setOrganizationFormat(getOrganizationFormat());
    window.addEventListener("nawa-organization-format", sync);
    window.addEventListener("nawa-appearance", sync);
    return () => { window.removeEventListener("nawa-organization-format", sync); window.removeEventListener("nawa-appearance", sync); };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    direction,
    setLanguage,
    t: key => translations[language][key] ?? translations.en[key],
    formatDate: (value, options) => options ? new Intl.DateTimeFormat(languageLocale[language], options).format(new Date(value)) : formatOrganizationDate(value, organizationFormat),
    formatNumber: (value, options) => options ? new Intl.NumberFormat(languageLocale[language], options).format(value) : formatOrganizationNumber(value, organizationFormat),
    formatCurrency: value => formatOrganizationCurrency(value, organizationFormat),
    formatTime: value => formatOrganizationTime(value, organizationFormat),
  }), [language, direction, organizationFormat]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
