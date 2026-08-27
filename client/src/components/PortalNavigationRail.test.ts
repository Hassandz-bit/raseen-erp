import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/PortalNavigationRail.tsx"), "utf8");

describe("مكوّن تنقل البوابات المركزي", () => {
  it("يفصل وضع الأدوات الموسع عن الوضع المضغوط", () => {
    expect(source).toContain("navigationRendersExpanded ? <div className=\"nawa-expanded-navigation\"");
    expect(source).toContain('className="nawa-rail-groups"');
    expect(source).toContain("nawa-navigation-rail-expanded");
  });

  it("يعرض أسماء الأدوات والحالة النشطة في الوضع الموسع", () => {
    expect(source).toContain('className={`nawa-expanded-page ${isActive ? "nawa-expanded-page-active" : ""}`}');
    expect(source).toContain('aria-current={isActive ? "page" : undefined}');
    expect(source).toContain("nawa-active-dot");
  });

  it("يوفر تلميحات قابلة للوصول للأيقونات في الوضع المضغوط", () => {
    expect(source).toContain("<Tooltip delayDuration={240}>");
    expect(source).toContain('className="nawa-navigation-tooltip"');
    expect(source).toContain("<TooltipContent side={tooltipSide}");
  });
});
