import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("توزيع رأس RASEEN ERP", () => {
  it("يبني رأس ERP كامل العرض بصف هوية وسياق وصف عمل مستقلين", () => {
    expect(layout).toContain('className="nawa-header-topline"');
    expect(layout).toContain('className="nawa-header-workline"');
    expect(layout).toContain('className="nawa-header-brandline"');
    expect(layout).toContain('className="nawa-header-organization"');
    expect(layout).toContain('className="nawa-header-context"');
    expect(layout).toContain('className="nawa-header-accountline"');
    expect(layout).toContain('className="nawa-header-breadcrumb truncate"');
    expect(layout).toContain('className="nawa-header-navigation"');
    expect(layout).toContain('className="nawa-header-search"');
    expect(layout).toContain('className="nawa-header-utilities"');
    expect(styles).toContain("width: 100vw; max-width: 100vw; min-width: 0; box-sizing: border-box");
  });

  it("يكبر الخط ويستعمل كامل العرض مع استجابة لا تخفي عناصر الهاتف الأساسية", () => {
    expect(styles).toContain(".nawa-organization-switcher > span > span:first-child { font-size: 1.16rem");
    expect(styles).toContain(".nawa-command-trigger { display: flex; width: 100%; min-width: 0; min-height: 46px");
    expect(layout).toContain('className="nawa-mobile-wordmark sm:hidden"');
    expect(layout).toContain("CircleHelp");
    expect(styles).toContain("@media (max-width: 900px) { .nawa-global-header { display: flex; height: 62px");
  });
});
