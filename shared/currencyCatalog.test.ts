import { describe, expect, it } from "vitest";
import { currencyCatalog, getCurrencyCatalogEntry } from "./currencyCatalog";

describe("كتالوج العملات", () => {
  it("يوفر أسماء مترجمة ورمزاً ودقة صالحة لكل عملة", () => {
    expect(currencyCatalog.length).toBeGreaterThan(20);
    for (const currency of currencyCatalog) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/);
      expect(currency.symbol.length).toBeGreaterThan(0);
      expect(currency.decimalPlaces).toBeGreaterThanOrEqual(0);
      expect(currency.decimalPlaces).toBeLessThanOrEqual(3);
      expect(currency.names.ar.length).toBeGreaterThan(0);
      expect(currency.names.fr.length).toBeGreaterThan(0);
      expect(currency.names.en.length).toBeGreaterThan(0);
    }
  });

  it("يعيد عملة الأساس المعروفة ولا يعيد قيمة لرمز غير موجود", () => {
    expect(getCurrencyCatalogEntry("DZD")?.names.ar).toBe("الدينار الجزائري");
    expect(getCurrencyCatalogEntry("ZZZ")).toBeUndefined();
  });
});
