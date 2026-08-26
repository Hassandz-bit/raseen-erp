import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const portalsSource = readFileSync(resolve(process.cwd(), "client/src/pages/PortalsHome.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const portalConfigSource = readFileSync(resolve(process.cwd(), "client/src/config/nawaPortals.ts"), "utf8");
const guideSource = readFileSync(resolve(process.cwd(), "client/src/pages/DemoGuide.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("صفحة بوابات Nawa", () => {
  it("تستمد البطاقات من تعريف البوابات المركزي وحالة الاشتراك فقط", () => {
    expect(portalsSource).toContain("orderedPortals.map");
    expect(portalsSource).toContain("trpc.erp.bootstrap.useQuery");
    expect(portalsSource).toContain("requiredModules");
    expect(portalsSource).not.toContain("organizationId=");
  });

  it("يفصل صفحة البوابات عن الملخص التنفيذي", () => {
    expect(appSource).toContain('path="/" component={PortalsHome}');
    expect(appSource).toContain('path="/executive" component={Home}');
  });

  it("لا يعرض بوابة ذكاء رصين أو مسار مساحة العمل غير التشغيلي", () => {
    expect(portalsSource).not.toContain('a.id === "ai"');
    expect(portalConfigSource).not.toContain('id: "ai"');
    expect(appSource).toContain('<Route path="/workspace"><Redirect to="/executive" /></Route>');
  });

  it("يعرض دليل Demo ومؤشراته فقط عند وسم المؤسسة الخادمي", () => {
    expect(appSource).toContain('path="/demo-guide" component={DemoGuide}');
    expect(portalsSource).toContain('organization?.isDemo === "yes"');
    expect(guideSource).toContain("trpc.erp.demo.metrics.useQuery");
    expect(guideSource).toContain("seedRetailHrPayrollScenarios.useMutation");
    expect(layoutSource).toContain('organization?.isDemo === "yes"');
    expect(layoutSource).toContain("chrome.demo");
  });
});
