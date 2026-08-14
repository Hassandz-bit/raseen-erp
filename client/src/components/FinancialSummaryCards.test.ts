import { describe, expect, it } from "vitest";
import { buildFinancialSummaryCards } from "./FinancialSummaryCards";

describe("بطاقات الملخص المالي", () => {
  it("تستخدم مفاتيح الترجمة ومنسق العملة المركزي لكل قيمة", () => {
    const cards = buildFinancialSummaryCards(
      { totalIncome: 1200, totalExpenses: 350, netProfit: 850 },
      key => ({ revenue: "Revenu", expenses: "Dépenses", netProfit: "Bénéfice net" })[key],
      value => `DZD ${value.toFixed(2)}`,
    );
    expect(cards).toEqual([
      expect.objectContaining({ key: "revenue", label: "Revenu", value: "DZD 1200.00" }),
      expect.objectContaining({ key: "expenses", label: "Dépenses", value: "DZD 350.00" }),
      expect.objectContaining({ key: "netProfit", label: "Bénéfice net", value: "DZD 850.00", wide: true }),
    ]);
  });
});
