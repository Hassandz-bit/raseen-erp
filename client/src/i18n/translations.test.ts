import { describe, expect, it } from "vitest";
import { getDirection, glossary, translations } from "./translations";

describe("i18n foundation", () => {
  it("يعرض اتجاه RTL للعربية وLTR للفرنسية والإنجليزية", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("fr")).toBe("ltr");
    expect(getDirection("en")).toBe("ltr");
  });

  it("يوفر نفس مفاتيح التجربة المشتركة بكل اللغات المدعومة", () => {
    const baseKeys = Object.keys(translations.ar).sort();
    expect(Object.keys(translations.fr).sort()).toEqual(baseKeys);
    expect(Object.keys(translations.en).sort()).toEqual(baseKeys);
    expect(glossary.ar.inventory).toBeTruthy();
    expect(glossary.fr.inventory).toBeTruthy();
    expect(glossary.en.inventory).toBeTruthy();
  });
});
