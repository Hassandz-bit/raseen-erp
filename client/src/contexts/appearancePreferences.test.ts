import { describe, expect, it } from "vitest";
import type { AppearancePreferences } from "./ThemeContext";

const defaults: AppearancePreferences = { themeMode: "dark", sidebarMode: "expanded", density: "comfortable", fontFamily: "ibm-plex", fontScale: "normal", sidebarFontScale: "normal", highContrast: false, tabletSidebarWidth: "normal", numeralStyle: "western", accentColor: "gold", radiusPreset: "rounded", moduleViewMode: "classic" };

describe("تفضيلات المظهر", () => {
  it("تتضمن القيم الافتراضية الآمنة ونمط الأرقام والحجم الكبير", () => {
    expect(defaults).toMatchObject({ themeMode: "dark", numeralStyle: "western", fontScale: "normal", sidebarFontScale: "normal", highContrast: false, tabletSidebarWidth: "normal", moduleViewMode: "classic" });
    expect((["small", "normal", "large", "extra_large"] as const)).toContain("extra_large");
    expect((["western", "arabic_indic"] as const)).toContain("arabic_indic");
  });

  it("يعيد بناء التفضيلات الافتراضية عند الإعادة", () => {
    const altered: AppearancePreferences = { ...defaults, themeMode: "light", fontScale: "extra_large", numeralStyle: "arabic_indic" };
    expect({ ...defaults }).not.toEqual(altered);
    expect({ ...defaults }).toEqual(defaults);
  });

  it("يحصر خيارات الخط والحجم ونمط الأرقام وطريقة عرض الوحدات في القيم المدعومة", () => {
    expect((["ibm-plex", "tajawal", "noto-arabic", "inter", "system"] as const)).toContain(defaults.fontFamily);
    expect((["small", "normal", "large", "extra_large"] as const)).toContain(defaults.fontScale);
    expect((["small", "normal", "large", "extra_large"] as const)).toContain(defaults.sidebarFontScale);
    expect(typeof defaults.highContrast).toBe("boolean");
    expect((["narrow", "normal", "wide"] as const)).toContain(defaults.tabletSidebarWidth);
    expect((["western", "arabic_indic"] as const)).toContain(defaults.numeralStyle);
    expect((["classic", "nawa_flow"] as const)).toContain(defaults.moduleViewMode);
  });
});
