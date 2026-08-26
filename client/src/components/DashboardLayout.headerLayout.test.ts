import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("توزيع رأس RASEEN ERP", () => {
  it("يفصل علامة المنصة والبحث والإجراءات وهوية المؤسسة في مناطق مستقلة", () => {
    expect(layout).toContain('className="nawa-header-brand"');
    expect(layout).toContain('className="nawa-header-search"');
    expect(layout).toContain('className="nawa-header-utilities"');
    expect(layout).toContain('className="nawa-header-identity"');
    expect(styles).toContain("grid-template-columns: max-content minmax(18rem, 1fr) max-content minmax(15rem, 22rem)");
  });

  it("يكبر الخطوط ويحافظ على تباعد الأدوات مع تقليص مسؤول عند نقص المساحة", () => {
    expect(styles).toContain(".nawa-organization-switcher > span > span:first-child { font-size: 1rem");
    expect(styles).toContain(".nawa-header-utilities { gap: .25rem; border-inline:");
    expect(styles).toContain("@media (max-width: 1500px) { .nawa-header-print span { display: none !important; }");
  });
});
