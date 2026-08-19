import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildExchangeRateExcel, buildExchangeRatePdf } from "./exchangeRateExport";

describe("تصدير أسعار الصرف", () => {
  it("يبني محتوى Excel منظمًا مع التاريخ والمصدر", () => {
    const content = buildExchangeRateExcel([{ baseCurrencyCode: "DZD", quoteCurrencyCode: "EUR", rate: "0.0062", effectiveAt: new Date("2026-03-15T00:00:00Z"), source: "manual" }]);
    expect(content).toContain("<th>Base</th>");
    expect(content).toContain("<td>DZD</td>");
    expect(content).toContain("<td>EUR</td>");
    expect(content).toContain("<col style=\"width:");
  });

  it("يبني PDF متعدد الصفحات عند تجاوز 25 سجلاً", async () => {
    const rows = Array.from({ length: 26 }, (_, index) => ({ baseCurrencyCode: "DZD", quoteCurrencyCode: "EUR", rate: String(index + 1), effectiveAt: new Date("2026-03-15T00:00:00Z"), source: "manual" }));
    const bytes = await buildExchangeRatePdf(rows);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(2);
  });

  it("يقبل منسقات المؤسسة للنسبة والتاريخ في تصدير Excel", () => {
    const content = buildExchangeRateExcel([{ baseCurrencyCode: "DZD", quoteCurrencyCode: "EUR", rate: "0.0062", effectiveAt: new Date("2026-03-15T00:00:00Z"), source: "manual" }], {
      formatRate: value => `rate:${value.toFixed(4)}`,
      formatDate: () => "15/03/2026 01:00",
    });
    expect(content).toContain("rate:0.0062");
    expect(content).toContain("15/03/2026 01:00");
  });
});
