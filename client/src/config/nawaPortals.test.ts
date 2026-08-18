import { describe, expect, it } from "vitest";
import { getPortalForPath, nawaPortals } from "./nawaPortals";

describe("Nawa portals definition", () => {
  it("يعطي كل مسار قائم بوابة أساسية واحدة", () => {
    expect(getPortalForPath("/commerce")?.id).toBe("commerce");
    expect(getPortalForPath("/distribution")?.id).toBe("distribution");
    expect(getPortalForPath("/driver")?.id).toBe("distribution");
    expect(getPortalForPath("/retailer")?.id).toBe("retail");
    expect(getPortalForPath("/b2b-orders")?.id).toBe("retail");
    expect(getPortalForPath("/self-service")?.id).toBe("hr");
  });

  it("يحافظ على تسميات البوابات بثلاث لغات من دون فراغ", () => {
    for (const portal of nawaPortals) {
      expect(portal.name.ar).toBeTruthy();
      expect(portal.name.fr).toBeTruthy();
      expect(portal.name.en).toBeTruthy();
      expect(portal.localNavigation.length).toBeGreaterThan(0);
    }
  });

  it("يعرّف أدوات سياقية واسعة للبوابات التشغيلية الرئيسة", () => {
    const byId = (id: string) => nawaPortals.find(portal => portal.id === id)!;
    expect(byId("manufacturing").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["orders", "materials", "consumption", "stages", "output", "quality", "traceability", "costs"]));
    expect(byId("distribution").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["control", "routes", "fleet", "territories", "logistics-check", "driver"]));
    expect(byId("finance").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["accounts", "entries", "aging", "treasury", "reports"]));
    expect(byId("hr").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["employees", "attendance", "overtime", "leave", "payroll", "self-service"]));
    expect(byId("commerce").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["products", "warehouses", "batches", "sales", "purchases"]));
    expect(byId("retail").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["accesses", "outlets", "retail-users", "promotions", "retail-orders", "returns", "retailer"]));
    expect(byId("administration").localNavigation.map(item => item.id)).toEqual(expect.arrayContaining(["organization", "language", "currencies", "exchange-rates", "date-numbers", "appearance", "typography", "module-view", "printing", "branches", "users", "notifications", "security", "modules"]));
  });
});
