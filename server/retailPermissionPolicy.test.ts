import { describe, expect, it } from "vitest";
import { canUseRetailPermission } from "./retailPermissionPolicy";

describe("Retail supplier permission policy", () => {
  it("يمنح مالك المؤسسة جميع صلاحيات Retail دون قائمة مكررة", () => {
    expect(canUseRetailPermission("owner", [], "retail.access.manage")).toBe(true);
    expect(canUseRetailPermission("owner", [], "retail.orders.manage")).toBe(true);
  });

  it("يمنح المدير المفوض الصلاحيات المحددة أو نطاق Retail الكامل فقط", () => {
    expect(canUseRetailPermission("retail_manager", ["retail.access.manage"], "retail.access.manage")).toBe(true);
    expect(canUseRetailPermission("retail_manager", ["retail.*"], "retail.outlets.manage")).toBe(true);
    expect(canUseRetailPermission("retail_manager", ["retail.access.manage"], "retail.orders.manage")).toBe(false);
  });

  it("يرفض العضو غير المفوض حتى عند وجود علاقة Retail في المؤسسة", () => {
    expect(canUseRetailPermission("member", [], "retail.admin.view")).toBe(false);
  });
});
