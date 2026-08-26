import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("توزيع رأس RASEEN ERP", () => {
  it("يخصص ثلاث مناطق للرأس ويضع حداً أصغر لمربع البحث", () => {
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) clamp(20rem, 27vw, 29rem) minmax(0, 1fr)");
    expect(styles).toContain("max-width: 29rem");
  });

  it("يحافظ على وضوح اسم المؤسسة ويخفي تسمية الطباعة عند نقص المساحة", () => {
    expect(styles).toContain(".nawa-organization-switcher > span > span:first-child { font-size: .95rem");
    expect(styles).toContain("@media (max-width: 1500px) { .nawa-header-print span { display: none !important; }");
  });
});
