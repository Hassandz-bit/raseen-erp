import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { toastError, createBranch } = vi.hoisted(() => ({ toastError: vi.fn(), createBranch: vi.fn() }));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</>, DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/ExchangeRatesPanel", () => ({ ExchangeRatesPanel: () => null }));
vi.mock("@/components/DocumentPreviewActions", () => ({ DocumentPreviewActions: () => null }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ preferences: { themeMode: "dark", numeralStyle: "western", sidebarMode: "expanded", density: "comfortable", fontFamily: "inter", fontScale: "medium", accentColor: "gold", radiusPreset: "large", moduleViewMode: "classic" }, updatePreferences: vi.fn(), resetPreferences: vi.fn() }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "fr", setLanguage: vi.fn(), t: (key: string) => ({ settings: "Paramètres", preferences: "Préférences", branches: "Succursales", branchCode: "Code", branchName: "Nom", createBranch: "Ajouter", active: "Actif", inactive: "Inactif", branchCodeConflict: "Code déjà utilisé", branchSaveError: "Échec de sauvegarde", error: "Erreur", empty: "Vide", saved: "Enregistré", organization: "Organisation", language: "Langue", currencies: "Devises", exchangeRates: "Taux", dateAndNumbers: "Dates", appearance: "Apparence", typography: "Typographie", moduleView: "Modules", printing: "Impression" })[key] ?? key }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }));
vi.mock("@/lib/trpc", () => ({ trpc: { erp: { preferences: {
  user: { useQuery: () => ({ data: undefined }) }, organization: { useQuery: () => ({ data: undefined, refetch: vi.fn() }) }, currencyCatalog: { useQuery: () => ({ data: [] }) }, currencies: { useQuery: () => ({ data: [], refetch: vi.fn() }) }, branches: { useQuery: () => ({ data: [{ id: 1, name: "Alger", code: "ALG", status: "active" }], isLoading: false, isError: false, refetch: vi.fn() }) },
  saveUser: { useMutation: () => ({ mutate: vi.fn() }) }, saveOrganization: { useMutation: () => ({ mutate: vi.fn() }) }, saveCurrency: { useMutation: () => ({ mutate: vi.fn() }) }, createBranch: { useMutation: (options: { onError: (error: { data?: { code?: string } }) => void }) => ({ mutate: (...args: unknown[]) => { createBranch(...args); options.onError({ data: { code: "CONFLICT" } }); }, isPending: false }) },
} } } }));

import SettingsPage from "./Settings";

describe("قسم الفروع في الإعدادات", () => {
  it("يعرض حالة الفرع الفعلية ويربط تعارض الرمز برسالة مترجمة", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Succursales"));
    expect(screen.getByText("Alger")).toBeTruthy();
    expect(screen.getByText("Actif")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "ALG" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Alger centre" } });
    fireEvent.click(screen.getByText("Ajouter"));
    expect(createBranch).toHaveBeenCalledWith({ code: "ALG", name: "Alger centre" });
    expect(toastError).toHaveBeenCalledWith("Code déjà utilisé");
  });
});
