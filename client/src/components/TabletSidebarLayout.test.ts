import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const railSource = readFileSync(resolve(process.cwd(), "client/src/components/PortalNavigationRail.tsx"), "utf8");

describe("Rail التنقل في الوضع اللوحي", () => {
  it("يعتمد Rail مضغوطاً ولوحة سياقية مؤقتة بدلاً من شريط عريض دائم", () => {
    expect(railSource).toContain('className={`nawa-navigation-rail ${navigationRendersExpanded ? "nawa-navigation-rail-expanded" : ""} ${isRailOpenOnMobile ? "nawa-navigation-rail-open" : ""}`}');
    expect(layoutSource).toContain("const navigationRendersExpanded = navigationIsExpanded || isRailOpenOnMobile");
    expect(railSource).toContain('className="nawa-context-panel"');
    expect(railSource).toContain('className="nawa-rail-backdrop"');
  });

  it("يحافظ على أدوات البوابة داخل لوحة قابلة للإغلاق مع حقل بحث", () => {
    expect(railSource).toContain('placeholder={chrome.searchTools}');
    expect(railSource).toContain('onClick={() => onPanelOpenChange(false)}');
    expect(railSource).toContain('filteredTools.map(item =>');
  });
});
