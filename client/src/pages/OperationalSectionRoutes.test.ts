import { getPortal } from "@/config/nawaPortals";
import { describe, expect, it } from "vitest";

describe("مسارات الجداول التشغيلية", () => {
  it("يربط المالية بجداول مستقلة للحسابات والقيود والذمم والخزينة والتقارير", () => {
    const routes = getPortal("finance")!.localNavigation.map(item => item.href);
    ["/finance/accounts", "/finance/entries", "/finance/aging", "/finance/treasury", "/finance/reports"].forEach(route => expect(routes).toContain(route));
  });

  it("يربط الموارد البشرية بجداول مستقلة للموظفين والوقت والرواتب", () => {
    const routes = getPortal("hr")!.localNavigation.map(item => item.href);
    ["/hr/employees", "/hr/attendance", "/hr/overtime", "/hr/leave", "/hr/payroll"].forEach(route => expect(routes).toContain(route));
  });

  it("يربط Retail بجداول مستقلة للعلاقات والمنافذ والعروض والطلبات والإرجاعات", () => {
    const routes = getPortal("retail")!.localNavigation.map(item => item.href);
    ["/retail/accesses", "/retail/outlets", "/retail/users", "/retail/promotions", "/retail/orders", "/retail/returns"].forEach(route => expect(routes).toContain(route));
  });
});
