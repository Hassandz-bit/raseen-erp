import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("توزيع رأس RASEEN ERP", () => {
  it("يضع البحث في مقدمة ترتيب RTL ويمنحه عرضاً واضحاً غير مفرط", () => {
    expect(styles).toContain(".nawa-command-trigger { display: flex; order: -1; width: clamp(18rem, 24vw, 28rem)");
    expect(styles).toContain(".nawa-command-actions { flex: 0 0 auto; margin-inline-start: auto");
  });

  it("يحافظ على وضوح اسم المؤسسة ويخفي تسمية الطباعة عند نقص المساحة", () => {
    expect(styles).toContain(".nawa-organization-switcher > span > span:first-child { font-size: 1.05rem");
    expect(styles).toContain("@media (max-width: 1500px) { .nawa-header-print span { display: none !important; }");
  });
});
