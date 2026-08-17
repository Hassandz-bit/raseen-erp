import { describe, expect, it } from "vitest";
import { buildRetailerReportCsv, buildRetailerReportPdf } from "./retailerReportExport";

const report = {
  period: { month: 8, year: 2026 },
  currencyCode: "DZD",
  summary: { orderCount: 1, orderTotal: 1200, invoiceCount: 1, invoicedTotal: 1200, outstandingBalance: 500 },
  orders: [{ orderNumber: "B2B-0001", status: "confirmed", paymentStatus: "partial", totalAmount: "1200", currencyCode: "DZD", createdAt: "2026-08-10T00:00:00.000Z" }],
  invoices: [{ invoiceNumber: "INV-0001", status: "issued", grandTotal: "1200", amountPaid: "700", currencyCode: "DZD", issuedAt: "2026-08-12T00:00:00.000Z" }],
};

describe("Retailer monthly report export", () => {
  it("يصدر CSV بالملخص والطلبات والفواتير المرئية فقط", () => {
    const csv = buildRetailerReportCsv(report);
    expect(csv).toContain("B2B-0001");
    expect(csv).toContain("INV-0001");
    expect(csv).toContain("Outstanding balance");
    expect(csv).not.toContain("cost");
  });

  it("ينشئ ملف PDF قابل للتنزيل للتقرير الشهري", async () => {
    const pdf = await buildRetailerReportPdf(report);
    expect(pdf.byteLength).toBeGreaterThan(100);
  });
});
