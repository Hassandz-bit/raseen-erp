import { describe, expect, it } from "vitest";
import { buildDocumentPreviewHtml } from "./documentPreviewExport";

describe("تصدير معاينة المستند", () => {
  it("يحافظ على العربية ويؤمّن النص قبل عرضه في وثيقة قابلة للطباعة", () => {
    const html = buildDocumentPreviewHtml({ direction: "rtl", title: "فاتورة <تجريبية>", date: "2026-08-14", documentLabel: "المستند", amount: "١٬٢٥٠٫٥٠ د.ج", footer: "معلومة قانونية", signatureLabel: "التوقيع" });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("فاتورة &lt;تجريبية&gt;");
    expect(html).toContain("١٬٢٥٠٫٥٠ د.ج");
  });
});
