import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const portalsSource = readFileSync(resolve(process.cwd(), "client/src/pages/PortalsHome.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

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

  it("يقدّم بوابة Nawa AI في ترتيب البطاقات", () => {
    expect(portalsSource).toContain('a.id === "ai" ? -1');
    expect(portalsSource).toContain('isAiPortal ? "Nawa AI"');
  });
});
