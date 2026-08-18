import { describe, expect, it } from "vitest";
import { DEMO_ORGANIZATION } from "./demo";

describe("شركة Nawa Demo", () => {
  it("تستخدم معرفاً ثابتاً ووحدات كاملة وبيانات عملة محلية", () => {
    expect(DEMO_ORGANIZATION.slug).toBe("nawa-demo");
    expect(DEMO_ORGANIZATION.name).toContain("نواة");
    expect(DEMO_ORGANIZATION.moduleKeys).toEqual(expect.arrayContaining(["inventory", "manufacturing", "distribution", "nawa_retail", "finance", "hr"]));
  });

  it("تحدد فروعاً ومخازن منفصلة قابلة لإعادة التهيئة", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("DEMO-HQ");
    expect(source).toContain("DEMO-CENTRAL");
    expect(source).toContain("demo.foundation.seeded");
  });

  it("يتطلب حذف بيانات العرض عبارة تأكيد صريحة", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain('confirmation !== "DELETE NAWA DEMO"');
    expect(source).toContain('organization.isDemo !== "yes"');
    expect(source).toContain("information_schema.columns");
  });
});
