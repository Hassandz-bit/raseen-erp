import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/PortalNavigationRail.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

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
    expect(source).toContain('className="nawa-rail-icon"');
    expect(source).toContain('className="nawa-expanded-page-icon"');
  });

  it("يوفر تلميحات قابلة للوصول للأيقونات في الوضع المضغوط", () => {
    expect(source).toContain("<Tooltip delayDuration={240}>");
    expect(source).toContain('className="nawa-navigation-tooltip"');
    expect(source).toContain("<TooltipContent side={tooltipSide}");
  });

  it("يستخدم حركة خفيفة عند الانتقال للملاحة الموسعة ويحترم تقليل الحركة", () => {
    expect(styles).toContain("transition: width .22s cubic-bezier(.23,1,.32,1)");
    expect(styles).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styles).toContain("@keyframes nawa-rail-content-in");
    expect(styles).toContain("opacity: 0; transform: translateX(8px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("يكبر الشريط وعناصره بنسبة 60% تقريباً على سطح المكتب ويحافظ على مقاس لمس مناسب للهاتف", () => {
    expect(styles).toContain("width: var(--nawa-rail-width, 116px); height: calc(100dvh - 126px); flex-basis: var(--nawa-rail-width, 116px)");
    expect(styles).toContain(".nawa-rail-button { width: 4.4rem; height: 4.4rem");
    expect(styles).toContain(".nawa-rail-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.26rem");
    expect(styles).toContain(".nawa-expanded-page { display: flex; width: 100%; align-items: center; gap: .8rem");
    expect(styles).toContain("@media (max-width: 900px) { .nawa-navigation-rail { width: 72px; flex-basis: 72px");
  });
});
