import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("مداخل Nawa في الصفحة الرئيسية", () => {
  it("يعرض Nawa AI وNawa Retail في بداية الشريط الجانبي", () => {
    const dashboard = source.indexOf('{ key: "dashboard", label: "dashboard"');
    const ai = source.indexOf('{ key: "nawaAI", label: "Nawa AI", icon: Bot, path: "/workspace" }');
    const retail = source.indexOf('{ key: "nawaRetail", label: "Nawa Retail", icon: Store, path: "/retailer" }');
    const inventory = source.indexOf('{ key: "inventory", label: "inventory"');
    expect(dashboard).toBeLessThan(ai);
    expect(ai).toBeLessThan(retail);
    expect(retail).toBeLessThan(inventory);
  });

  it("يتنقل عبر مسارات ثابتة بلا معرفات مؤسسة في المتصفح", () => {
    expect(source).toContain('item.path ? setLocation(item.path) : changeSection(item.key as SectionKey)');
    expect(source).not.toContain('/retailer?organizationId=');
  });
});
