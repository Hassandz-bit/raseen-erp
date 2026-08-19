import { describe, expect, it } from "vitest";
import { buildDocumentPreviewFilename, buildDocumentPreviewHtml, buildDocumentPreviewPdfFilename, createDocumentPreviewDownload } from "./documentPreviewExport";

describe("تصدير معاينة المستند", () => {
  it("يحافظ على العربية ويؤمّن النص قبل عرضه في وثيقة قابلة للطباعة", () => {
    const html = buildDocumentPreviewHtml({ direction: "rtl", title: "فاتورة <تجريبية>", date: "2026-08-14", documentLabel: "المستند", amount: "١٬٢٥٠٫٥٠ د.ج", footer: "معلومة قانونية", signatureLabel: "التوقيع", rows: [{ label: "صافي الربح", value: "١٬٠٠٠" }, { label: "<مؤشر>", value: "<قيمة>" }], fontFamily: "noto-arabic", fontSize: "large", paperSize: "thermal" });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("فاتورة &lt;تجريبية&gt;");
    expect(html).toContain("١٬٢٥٠٫٥٠ د.ج");
    expect(html).toContain("font-family:Noto Arabic");
    expect(html).toContain("font-size:18px");
    expect(html).toContain("width:80mm");
    expect(html).toContain("صافي الربح");
    expect(html).toContain("&lt;مؤشر&gt;");
  });

  it("يضم شعار المؤسسة المخزن في مساحة المشروع ويرفض رابطاً خارجياً في المستند", () => {
    const withLogo = buildDocumentPreviewHtml({ direction: "rtl", title: "فاتورة", date: "2026-08-14", documentLabel: "مستند", amount: "100", logoUrl: "/manus-storage/organizations/3/document-logo.png" });
    const externalLogo = buildDocumentPreviewHtml({ direction: "rtl", title: "فاتورة", date: "2026-08-14", documentLabel: "مستند", amount: "100", logoUrl: "https://example.com/logo.png" });
    expect(withLogo).toContain('src="/manus-storage/organizations/3/document-logo.png"');
    expect(externalLogo).not.toContain("example.com/logo.png");
  });

  it("يعرض الترويسة القانونية والعلامة المائية الباهتة للشعار المعزول", () => {
    const html = buildDocumentPreviewHtml({ direction: "rtl", title: "فاتورة", date: "2026-08-14", documentLabel: "مستند", amount: "100", logoUrl: "/manus-storage/organizations/3/document-logo.png", taxNumber: "123456789", legalInfo: "سجل تجاري 42", useLogoWatermark: true });
    expect(html).toContain("الرقم الضريبي: 123456789");
    expect(html).toContain("سجل تجاري 42");
    expect(html).toContain('class="watermark"');
    expect(html).toContain("opacity:.055");
  });

  it("يجهز ملف معاينة HTML مسمى قابل للطباعة والحفظ PDF من المتصفح", () => {
    const result = createDocumentPreviewDownload({ direction: "rtl", title: "مستند", date: "2026-08-14", documentLabel: "فاتورة", amount: "١٠٠" }, "nawa-document-preview");
    expect(result.filename).toBe("nawa-document-preview.html");
    expect(result.blob.type).toBe("text/html;charset=utf-8");
  });

  it("ينشئ اسماً ثابتاً ومترجماً لغةً لملف التنزيل المباشر", () => {
    expect(buildDocumentPreviewFilename("ar", new Date("2026-08-16T12:00:00.000Z"))).toBe("nawa-ar-2026-08-16.html");
  });

  it("ينشئ اسماً ثابتاً لتنزيل PDF المباشر", () => {
    expect(buildDocumentPreviewPdfFilename("ar", new Date("2026-08-16T12:00:00.000Z"))).toBe("nawa-ar-2026-08-16.pdf");
  });
});
