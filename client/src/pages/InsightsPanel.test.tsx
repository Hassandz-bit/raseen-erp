import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    direction: "ltr",
    language: "fr",
    t: (key: string) => ({ financialSummary: "Résumé financier", currentMonth: "Mois en cours", commerceSnapshot: "Indicateurs commerce", openInvoices: "Factures ouvertes", lowStockProducts: "Produits à faible stock", issuedValue: "Valeur facturée", notificationCenter: "Notifications", subscriptionModules: "Modules", organizationAccessStatus: "Accès organisation", enabled: "Activé", locked: "Verrouillé", revenue: "Revenus", expenses: "Dépenses", netProfit: "Bénéfice net", exportCsv: "Exporter CSV" })[key] ?? key,
    formatCurrency: (value: number) => `DZD ${value.toFixed(2)}`,
    formatNumber: (value: number) => `#${value}`,
    formatDate: () => "16/08/2026",
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    erp: {
      reports: {
        summary: { useQuery: () => ({ data: { totalIncome: 1200, totalExpenses: 350, netProfit: 850, issuedInvoices: 2, products: 4 }, isLoading: false, isError: false }) },
        commerceSummary: { useQuery: () => ({ data: { openInvoices: 2, openPurchaseOrders: 1, lowStockProducts: 3, issuedValue: 700 }, isLoading: false, isError: false }) },
      },
      notifications: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false }) }, markRead: { useMutation: () => ({ mutate: vi.fn() }) } },
    },
  },
}));

vi.mock("@/components/AIChatBox", () => ({ AIChatBox: () => null }));

import { InsightsPanel, OperationalOverview } from "./Workspace";

describe("InsightsPanel UI", () => {
  it("يعرض البطاقات المترجمة وقيم المؤسسة المنسقة", () => {
    render(<InsightsPanel modules={[{ key: "inventory", status: "active" }]} />);
    expect(screen.getByText("Résumé financier")).toBeTruthy();
    expect(screen.getByText("Indicateurs commerce")).toBeTruthy();
    expect(screen.getByText("DZD 1200.00")).toBeTruthy();
    expect(screen.getByText("DZD 700.00")).toBeTruthy();
    expect(screen.getByText("Activé")).toBeTruthy();
  });
});

describe("OperationalOverview UI", () => {
  it("يعرض حالة الوحدات ويحدّث المؤشر المحدد عند اختيار وحدة", () => {
    render(<OperationalOverview modules={[{ key: "inventory", status: "active" }, { key: "sales", status: "suspended" }]} />);
    expect(screen.getByText("Suivi des modules")).toBeTruthy();
    expect(screen.getByText("Actif")).toBeTruthy();
    expect(screen.getByText("Suspendu")).toBeTruthy();
    fireEvent.click(screen.getByText("sales"));
    expect(screen.getAllByText(/Valeur facturée/).length).toBeGreaterThan(0);
  });
});
