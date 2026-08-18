import { describe, expect, it } from "vitest";
import { buildSalesInvoicePdfInput } from "./salesInvoicePdfExport";

describe("قالب PDF الرسمي لفاتورة المبيعات", () => {
  it("يبني ملخص الضريبة والبنود من القيم المحفوظة في الفاتورة", () => {
    const pdf = buildSalesInvoicePdfInput({
      organizationName: "شركة نواة",
      customerName: "عميل الاختبار",
      documentSettings: { footerText: "بيان رسمي", paperSize: "A4", showSignature: true },
      invoice: { invoiceNumber: "INV-009", status: "issued", currencyCode: "SAR", taxMode: "exclusive", netAmount: "100", taxAmount: "19", discountAmount: "0", grandTotal: "119", dueDate: null, createdAt: "2026-08-18T00:00:00.000Z" },
      items: [{ id: 1, productName: "منتج تجريبي", sku: "SKU-1", quantity: "1", unit: "قطعة", unitPrice: "100", taxRate: "19", lineTotal: "119" }],
    }, "ar");

    expect(pdf).toMatchObject({ direction: "rtl", paperSize: "A4", footer: "بيان رسمي", signatureLabel: "ختم وتوقيع الجهة المصدرة" });
    expect(pdf.title).toContain("فاتورة ضريبية");
    expect(pdf.documentLabel).toContain("INV-009");
    expect(pdf.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "صافي المبلغ" }),
      expect.objectContaining({ label: "ضريبة القيمة المضافة" }),
      expect.objectContaining({ label: "الإجمالي المستحق" }),
      expect.objectContaining({ label: "تفاصيل البنود 1: منتج تجريبي (SKU-1)" }),
    ]));
  });
});
