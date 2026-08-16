import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mode: "loading" as "loading" | "error" | "data" }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    formatSettings: { locale: "en-US", numeralStyle: "western", decimalPlaces: 2, decimalSeparator: ".", thousandSeparator: ",", dateFormat: "YYYY-MM-DD", timezone: "UTC", timeFormat: "24h" },
    t: (key: string) => ({
      exchangeHistoryTitle: "Exchange history", exchangeHistoryDescription: "Historical rates", addExchangeRate: "Add rate", baseCurrency: "Base", quoteCurrency: "Quote", exchangeRate: "Rate", filterExchangeRates: "Filters", currency: "Currency", from: "From", to: "To", clearFilters: "Clear", effectiveDate: "Effective date", rateSource: "Source", noMatchingExchangeRates: "No rates", retry: "Retry", exportSpreadsheet: "Export spreadsheet", downloadPdf: "Download PDF", validRateRequired: "Valid rate required", exchangeRateAdded: "Rate added", refreshingExchangeRates: "Refreshing rates", exchangeRatesLoadError: "Unable to load rates",
    })[key] ?? key,
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    erp: {
      preferences: {
        organization: { useQuery: () => ({ data: { currencyCode: "DZD" }, isLoading: false }) },
        exchangeRates: { useQuery: () => ({
          data: state.mode === "data" ? [{ id: 1, baseCurrencyCode: "DZD", quoteCurrencyCode: "EUR", rate: "0.0062", effectiveAt: new Date("2026-03-15T00:00:00Z"), source: "manual" }] : [],
          isLoading: state.mode === "loading", isError: state.mode === "error", refetch: vi.fn(),
        }) },
        addExchangeRate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  },
}));

import { ExchangeRatesPanel } from "./ExchangeRatesPanel";

afterEach(() => cleanup());

describe("سجل أسعار الصرف", () => {
  it("يعرض حالة التحميل", () => {
    state.mode = "loading";
    render(<ExchangeRatesPanel />);
    expect(screen.getByText("Refreshing rates")).toBeTruthy();
  });

  it("يعرض حالة الخطأ مع إجراء إعادة المحاولة", () => {
    state.mode = "error";
    render(<ExchangeRatesPanel />);
    expect(screen.getByText("Unable to load rates")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("يفعّل تصدير Excel وPDF عند وجود سجل", () => {
    state.mode = "data";
    render(<ExchangeRatesPanel />);
    expect(screen.getByText("DZD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excel" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "PDF" }).hasAttribute("disabled")).toBe(false);
  });
});
