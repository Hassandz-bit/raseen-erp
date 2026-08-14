import { describe, expect, it } from "vitest";
import { applyNumeralStyle, formatOrganizationCurrency, formatOrganizationDate, formatOrganizationNumber } from "./formatting";
import { getCurrencyCatalogEntry } from "../../../shared/currencyCatalog";

describe("organization formatting", () => {
  it("يفصل تنسيق الرقم عن لغة الواجهة", () => {
    expect(formatOrganizationNumber(12345.6, { decimalPlaces: 2, decimalSeparator: "comma", thousandsSeparator: "space" })).toBe("12 345,60");
    expect(formatOrganizationNumber(12345.6, { decimalPlaces: 1, decimalSeparator: "dot", thousandsSeparator: "comma" })).toBe("12,345.6");
  });
  it("يطابق موضع رمز العملة وإعداد التاريخ المؤسسي", () => {
    expect(formatOrganizationCurrency(42, { currencyCode: "EUR", currencySymbolPosition: "before", decimalPlaces: 2, decimalSeparator: "dot", thousandsSeparator: "comma" })).toBe("€ 42.00");
    expect(formatOrganizationDate("2026-08-14T12:00:00Z", { dateFormat: "YYYY-MM-DD", timeZone: "UTC" })).toBe("2026-08-14");
  });
  it("يفصل شكل الأرقام العربي الهندي عن فواصل الرقم ومكان رمز العملة", () => {
    expect(applyNumeralStyle("1,250.50", "arabic_indic")).toBe("١٬٢٥٠٫٥٠");
    expect(formatOrganizationCurrency(1250.5, { currencyCode: "AED", currencySymbolPosition: "after", decimalPlaces: 2, decimalSeparator: "dot", thousandsSeparator: "comma", numeralStyle: "arabic_indic" })).toBe("١٬٢٥٠٫٥٠ د.إ");
  });
  it("يتضمن العملات العربية والعالمية المطلوبة ويحترم الدقة الثلاثية", () => {
    expect(getCurrencyCatalogEntry("KWD")?.decimalPlaces).toBe(3);
    expect(getCurrencyCatalogEntry("BHD")?.decimalPlaces).toBe(3);
    expect(getCurrencyCatalogEntry("OMR")?.decimalPlaces).toBe(3);
    expect(["GBP", "CHF", "CNY", "TRY", "ILS"].every(code => Boolean(getCurrencyCatalogEntry(code)))).toBe(true);
  });
});
