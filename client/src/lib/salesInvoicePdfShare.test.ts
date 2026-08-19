import { describe, expect, it } from "vitest";
import { buildCustomerEmailUrl, buildWhatsAppCustomerUrl } from "./salesInvoicePdfExport";

describe("مشاركة فاتورة المبيعات", () => {
  it("يبني رابط واتساب للرقم الدولي فقط ويشفر الرسالة", () => {
    expect(buildWhatsAppCustomerUrl("+213 555 000 111", "فاتورة #1 & تحقق")).toBe("https://wa.me/213555000111?text=%D9%81%D8%A7%D8%AA%D9%88%D8%B1%D8%A9%20%231%20%26%20%D8%AA%D8%AD%D9%82%D9%82");
    expect(buildWhatsAppCustomerUrl("0555 000 111", "فاتورة")).toBeUndefined();
  });

  it("يبني mailto لبريد صالح فقط ويمنع القيم غير الصالحة", () => {
    expect(buildCustomerEmailUrl("client@example.com", "فاتورة 1", "رابط التحقق")).toBe("mailto:client%40example.com?subject=%D9%81%D8%A7%D8%AA%D9%88%D8%B1%D8%A9%201&body=%D8%B1%D8%A7%D8%A8%D8%B7%20%D8%A7%D9%84%D8%AA%D8%AD%D9%82%D9%82");
    expect(buildCustomerEmailUrl("not-an-email", "فاتورة", "محتوى")).toBeUndefined();
  });
});
