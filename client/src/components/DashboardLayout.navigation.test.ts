import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("تنقل بوابات Nawa", () => {
  it("يستمد البوابة والتنقل المحلي من تعريف مركزي", () => {
    expect(source).toContain("getPortalForPath");
    expect(source).toContain("activePortal?.localNavigation");
    expect(source).toContain("chrome.ai");
  });

  it("يبقي الرئيسية خفيفة ولا يعيد القائمة العالمية السابقة", () => {
    expect(source).toContain("chrome.portals");
    expect(source).not.toContain("const menuItems = [");
  });

  it("يحفظ آخر بوابة ويربط الرأس بسياق المؤسسة دون أي معرف عميل", () => {
    expect(source).toContain('localStorage.setItem("nawa:last-portal"');
    expect(source).toContain("bootstrap.data?.organization?.name");
    expect(source).not.toContain("organizationId=");
  });

  it("يعرض Nawa AI كمدخل دائم ويحذف البحث ومبدل البوابات المكرر", () => {
    expect(source).toContain("chrome.ai");
    expect(source).toContain('navigateTo("/workspace", chrome.ai)');
    expect(source).not.toContain("placeholder={chrome.search}");
    expect(source).not.toContain("nawaPortals.map(portal");
  });
});
