import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const invoiceDetail = readFileSync(resolve(process.cwd(), "client/src/pages/CommerceRecordDetail.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("إجراءات طباعة الفاتورة", () => {
  it("يعرض الطباعة وحفظ PDF ضمن تفاصيل فاتورة المبيعات فقط", () => {
    expect(invoiceDetail).toContain('safeSection === "sales"');
    expect(invoiceDetail).toContain("window.print()");
    expect(invoiceDetail).toContain("printLabel");
    expect(invoiceDetail).toContain("downloadSalesInvoicePdf");
  });

  it("لا يستدعي معاينة الطباعة في الرأس العام", () => {
    expect(shell).not.toContain("PagePrintPreview");
  });
});
