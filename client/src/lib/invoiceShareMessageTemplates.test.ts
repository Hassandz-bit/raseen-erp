import { describe, expect, it } from "vitest";
import { getInvoiceShareTemplate, renderInvoiceShareTemplate } from "./invoiceShareMessageTemplates";

const values = { organization_name: "رصين للتجارة", customer_name: "أحمد", invoice_number: "INV-100", invoice_total: "1,250 DZD", verification_url: "https://example.test/verify" };

describe("قوالب مشاركة الفاتورة", () => {
  it("يستخدم القالب المحفوظ للغة المطلوبة مع متغيرات الفاتورة المسموحة", () => {
    const template = getInvoiceShareTemplate({ whatsapp: { ar: "{{customer_name}} — {{invoice_number}} — {{invoice_total}}" } }, "whatsapp", "ar");
    expect(renderInvoiceShareTemplate(template, values)).toBe("أحمد — INV-100 — 1,250 DZD");
  });

  it("يعود إلى القالب الافتراضي ويترك المتغير غير المعروف دون تحويل", () => {
    const fallback = getInvoiceShareTemplate(undefined, "emailSubject", "en");
    expect(renderInvoiceShareTemplate(fallback, values)).toContain("Invoice INV-100");
    expect(renderInvoiceShareTemplate("{{invoice_number}} {{unsafe_token}}", values)).toBe("INV-100 {{unsafe_token}}");
  });
});
