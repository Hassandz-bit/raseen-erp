import { describe, expect, it } from "vitest";
import { formatOrganizationCurrency, formatOrganizationDate, formatOrganizationNumber } from "./formatting";

describe("organization formatting", () => {
  it("يفصل تنسيق الرقم عن لغة الواجهة", () => {
    expect(formatOrganizationNumber(12345.6, { decimalPlaces: 2, decimalSeparator: "comma", thousandsSeparator: "space" })).toBe("12 345,60");
    expect(formatOrganizationNumber(12345.6, { decimalPlaces: 1, decimalSeparator: "dot", thousandsSeparator: "comma" })).toBe("12,345.6");
  });
  it("يطابق موضع رمز العملة وإعداد التاريخ المؤسسي", () => {
    expect(formatOrganizationCurrency(42, { currencyCode: "EUR", currencySymbolPosition: "before", decimalPlaces: 2, decimalSeparator: "dot", thousandsSeparator: "comma" })).toBe("€ 42.00");
    expect(formatOrganizationDate("2026-08-14T12:00:00Z", { dateFormat: "YYYY-MM-DD", timeZone: "UTC" })).toBe("2026-08-14");
  });
});
