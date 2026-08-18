import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("الملخص التنفيذي ضمن معمارية البوابات", () => {
  it("يستخدم الغلاف الموحد ولا يعيد إنشاء قائمة عالمية طويلة", () => {
    expect(source).toContain("<DashboardLayout>");
    expect(source).not.toContain("const navItems");
    expect(source).not.toContain("<aside");
  });

  it("يقدم روابط عميقة إلى مصادر الإجراءات الحقيقية", () => {
    expect(source).toContain('setLocation("/commerce/sales")');
    expect(source).toContain('setLocation("/alerts")');
    expect(source).not.toContain("organizationId=");
  });
});
