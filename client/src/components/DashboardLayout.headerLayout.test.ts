import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("توزيع رأس RASEEN ERP", () => {
  it("يستبدل الرأس السابق بصف هوية وصف عمل مستقلين", () => {
    expect(layout).toContain('className="nawa-header-topline"');
    expect(layout).toContain('className="nawa-header-workline"');
    expect(layout).toContain('className="nawa-header-brandline"');
    expect(layout).toContain('className="nawa-header-accountline"');
    expect(layout).toContain('className="nawa-header-navigation"');
    expect(layout).toContain('className="nawa-header-search"');
    expect(layout).toContain('className="nawa-header-utilities"');
    expect(styles).toContain("grid-template-rows: 48px 62px; height: 110px");
  });

  it("يفصل هوية المؤسسة عن أدوات العمل ويحافظ على خط واضح عبر الاستجابة", () => {
    expect(styles).toContain(".nawa-organization-switcher > span > span:first-child { font-size: 1rem");
    expect(styles).toContain(".nawa-header-accountline { justify-content: flex-start");
    expect(styles).toContain("@media (max-width: 900px) { .nawa-global-header { display: flex; height: 60px");
  });
});
