import { describe, expect, it } from "vitest";
import { buildSalesInvoiceExportCsv } from "./salesInvoiceExport";

describe("تصدير فواتير المبيعات", () => {
  it("يتضمن الصافي والضريبة والإجمالي ووضع السعر ويهّرب الحقول النصية", () => {
    const csv = buildSalesInvoiceExportCsv([{ invoiceNumber: "INV-1", status: "مسودة", taxMode: "inclusive", currencyCode: "SAR", netAmount: 100, taxAmount: 19, grandTotal: 119 }], { invoice: "الفاتورة", status: "الحالة", priceMode: "وضع السعر", netAmount: "الصافي", taxAmount: "الضريبة", grandTotal: "الإجمالي", currency: "العملة" });

    expect(csv).toContain('"الفاتورة","الحالة","وضع السعر","الصافي","الضريبة","الإجمالي","العملة"');
    expect(csv).toContain('"INV-1","مسودة","inclusive","100","19","119","SAR"');
    expect(csv.startsWith("\ufeff")).toBe(true);
  });
});
