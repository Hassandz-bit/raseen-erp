import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => ({ revenue: "Revenus", expenses: "Dépenses", netProfit: "Bénéfice net" })[key] ?? key,
    formatCurrency: (value: number) => `DZD ${value.toFixed(2)}`,
  }),
}));

import { FinancialSummaryCards } from "./FinancialSummaryCards";

describe("FinancialSummaryCards UI", () => {
  it("يعرض التسميات المترجمة والقيم المنسقة من سياق المؤسسة", () => {
    render(<FinancialSummaryCards values={{ totalIncome: 1200, totalExpenses: 350, netProfit: 850 }} />);
    expect(screen.getByText("Revenus")).toBeTruthy();
    expect(screen.getByText("Dépenses")).toBeTruthy();
    expect(screen.getByText("Bénéfice net")).toBeTruthy();
    expect(screen.getByText("DZD 1200.00")).toBeTruthy();
    expect(screen.getByText("DZD 850.00")).toBeTruthy();
  });
});
