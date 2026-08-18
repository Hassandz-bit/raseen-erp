import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("سياسة سجل تنبيهات القرار", () => {
  const source = readFileSync(new URL("./erp.ts", import.meta.url), "utf8");

  it("يجمع مؤشرات المؤسسة والإشعارات المخزنة وتنبيهات الأسطول داخل عقد واحد معزول", () => {
    expect(source).toMatch(/listDecisionAlerts:[\s\S]*?getTenantContext\(ctx\.user\.id\)/);
    expect(source).toMatch(/listDecisionAlerts:[\s\S]*?getDashboardMetrics\(context\.organization\.id\)/);
    expect(source).toMatch(/listDecisionAlerts:[\s\S]*?listNotificationsForOrganization\(context\.organization\.id\)/);
    expect(source).toMatch(/listDecisionAlerts:[\s\S]*?getDistributionOwnerAlertReasons\(context\.organization\.id\)/);
  });
});
