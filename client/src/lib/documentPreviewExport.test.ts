import { describe, expect, it } from "vitest";
import { buildDocumentPreviewHtml, createDocumentPreviewDownload } from "./documentPreviewExport";

describe("تصدير معاينة المستند", () => {
  it("يحافظ على العربية ويؤمّن النص قبل عرضه في وثيقة قابلة للطباعة", () => {
    const html = buildDocumentPreviewHtml({ direction: "rtl", title: "فاتورة <تجريبية>", date: "2026-08-14", documentLabel: "المستند", amount: "١٬٢٥٠٫٥٠ د.ج", footer: "معلومة قانونية", signatureLabel: "التوقيع" });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("فاتورة &lt;تجريبية&gt;");
    expect(html).toContain("١٬٢٥٠٫٥٠ د.ج");
  });

  it("يجهز ملف معاينة HTML مسمى قابل للطباعة والحفظ PDF من المتصفح", () => {
    const result = createDocumentPreviewDownload({ direction: "rtl", title: "مستند", date: "2026-08-14", documentLabel: "فاتورة", amount: "١٠٠" }, "nawa-document-preview");
    expect(result.filename).toBe("nawa-document-preview.html");
    expect(result.blob.type).toBe("text/html;charset=utf-8");
  });
});
