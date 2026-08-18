import { describe, expect, it } from "vitest";
import { isTrustedOrganizationLogoUrl, parseOrganizationLogoDataUrl } from "./organizationLogo";

describe("شعار المؤسسة", () => {
  it("يقبل PNG موقّعاً ويستخرج امتداد التخزين", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = parseOrganizationLogoDataUrl(`data:image/png;base64,${bytes.toString("base64")}`);
    expect(result).toMatchObject({ mimeType: "image/png", extension: "png" });
  });

  it("يرفض نوعاً معلناً لا يطابق محتوى الملف ويحصر الروابط في مصادر آمنة", () => {
    expect(() => parseOrganizationLogoDataUrl("data:image/jpeg;base64,iVBORw0KGgo=")) .toThrow("محتوى ملف الشعار");
    expect(isTrustedOrganizationLogoUrl("/manus-storage/organizations/1/logo.png")).toBe(true);
    expect(isTrustedOrganizationLogoUrl("https://example.com/logo.png")).toBe(false);
    expect(isTrustedOrganizationLogoUrl("javascript:alert(1)")).toBe(false);
  });
});
