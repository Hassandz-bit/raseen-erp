import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getPortal } from "@/config/nawaPortals";

const distributionSection = readFileSync(resolve(process.cwd(), "client/src/pages/DistributionSection.tsx"), "utf8");

describe("صفحات جداول التوزيع", () => {
  it("تعرض الجولات والمركبات والمناطق والتنبيهات من العقود التشغيلية الرسمية", () => {
    ["routes.list", "vehicles.list", "territories.list", "documentAlerts.useQuery"].forEach(contract => expect(distributionSection).toContain(contract));
  });

  it("يربط الشريط السياقي كل مجال تشغيل بصفحة جدول مستقلة", () => {
    const entries = getPortal("distribution")?.localNavigation ?? [];
    ["/distribution/routes", "/distribution/vehicles", "/distribution/territories", "/distribution/compliance"].forEach(route => expect(entries.some(item => item.href === route)).toBe(true));
  });
});
