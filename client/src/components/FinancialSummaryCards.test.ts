import { describe, expect, it } from "vitest";
import { FinancialSummaryCards } from "./FinancialSummaryCards";

describe("بطاقات الملخص المالي", () => {
  it("تعرّف مكوّن البطاقات المالي المستقل", () => {
    expect(FinancialSummaryCards.name).toBe("FinancialSummaryCards");
  });
});
