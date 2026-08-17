import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("تنقل Nawa AI وNawa Retail", () => {
  it("يعرض مدخل Nawa AI من خلال مساحة العمل المحكومة", () => {
    expect(source).toContain('label: "Nawa AI", path: "/workspace"');
  });

  it("يعرض مدخل Nawa Retail من دون تمرير معرف مؤسسة أو تخطي الحارس", () => {
    expect(source).toContain('label: "Nawa Retail", path: "/retailer"');
    expect(source).not.toContain('path: "/retailer?organizationId=');
  });

  it("يضع مدخلي Nawa في بداية التنقل بعد لوحة التحكم", () => {
    const dashboard = source.indexOf('label: t("dashboard"), path: "/"');
    const ai = source.indexOf('label: "Nawa AI", path: "/workspace"');
    const retail = source.indexOf('label: "Nawa Retail", path: "/retailer"');
    const commerce = source.indexOf('label: t("commerceInventory"), path: "/commerce"');
    expect(dashboard).toBeLessThan(ai);
    expect(ai).toBeLessThan(retail);
    expect(retail).toBeLessThan(commerce);
  });
});
