import { describe, expect, it } from "vitest";
import { isValidTextBarcode, normalizeTextBarcode } from "./barcodePolicy";

describe("سياسة الباركود النصي", () => {
  it("يطبع المسافات ويقبل الباركودات العربية واللاتينية المكونة من نص آمن", () => {
    expect(normalizeTextBarcode(" AB - 123 ")).toBe("AB-123");
    expect(isValidTextBarcode("AB-123")).toBe(true);
    expect(isValidTextBarcode("صنف-١٢٣")).toBe(true);
  });

  it("يرفض القيم القصيرة والفراغات والرموز غير المسموحة", () => {
    expect(isValidTextBarcode("A")).toBe(false);
    expect(isValidTextBarcode("AB 12")).toBe(true);
    expect(isValidTextBarcode("AB@12")).toBe(false);
  });
});
