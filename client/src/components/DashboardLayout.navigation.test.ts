import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("تنقل بوابات Nawa", () => {
  it("يستمد البوابة والتنقل المحلي من تعريف مركزي", () => {
    expect(source).toContain("getPortalForPath");
    expect(source).toContain("activePortal?.localNavigation");
    expect(source).toContain("nawaPortals.map");
  });

  it("يحافظ على مبدّل البوابات ولا يعيد القائمة العالمية السابقة", () => {
    expect(source).toContain("chrome.portals");
    expect(source).not.toContain("const menuItems = [");
  });

  it("يحفظ آخر بوابة ويربط الرأس بسياق المؤسسة دون أي معرف عميل", () => {
    expect(source).toContain('localStorage.setItem("nawa:last-portal"');
    expect(source).toContain("bootstrap.data?.organization?.name");
    expect(source).not.toContain("organizationId=");
  });
});
