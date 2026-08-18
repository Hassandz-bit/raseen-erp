import { describe, expect, it } from "vitest";
import { RASEEN_ANDROID_PACKAGE_ID, RASEEN_APP_VERSION } from "./AboutApp";
import { raseenPalettes } from "./BrandAppearance";
import { PWA_OPEN_INSTALL_EVENT } from "@/components/PwaStatus";

describe("صفحات هوية رصين", () => {
  it("تعرض إصدار المنصة ومعرف Android التقني المستقر", () => {
    expect(RASEEN_APP_VERSION).toBe("1.0.0");
    expect(RASEEN_ANDROID_PACKAGE_ID).toBe("com.nawa.erp");
    expect(PWA_OPEN_INSTALL_EVENT).toBe("nawa-pwa-open-install");
  });

  it("تحافظ على أربع لوحات تمييز مع هوية رصين الذهبية الافتراضية", () => {
    expect(raseenPalettes.map(palette => palette.id)).toEqual(["gold", "blue", "emerald", "violet"]);
    expect(raseenPalettes[0].ar).toBe("ذهب رصين");
  });
});
