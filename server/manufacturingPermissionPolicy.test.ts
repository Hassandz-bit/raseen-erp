import { describe, expect, it } from "vitest";
import { canAccessManufacturingOrderScope, canUseManufacturingPermission, manufacturingRolePresets } from "./manufacturingPermissionPolicy";

describe("سياسة صلاحيات التصنيع", () => {
  it("يسمح لمدير الإنتاج بالتشغيل ويرفض الموظف العادي غير الممنوح", () => {
    expect(canUseManufacturingPermission("production_manager", [...manufacturingRolePresets.production_manager], "manufacturing.order.approve")).toBe(true);
    expect(canUseManufacturingPermission("member", ["manufacturing.view"], "manufacturing.order.approve")).toBe(false);
    expect(canUseManufacturingPermission("owner", [], "manufacturing.costs.edit")).toBe(true);
    expect(canUseManufacturingPermission("owner", [], "manufacturing.reports.export")).toBe(true);
  });

  it("يسمح للمفتش بفحص الجودة من دون كشف صلاحيات التكلفة", () => {
    const inspectorPermissions = [...manufacturingRolePresets.quality_inspector];
    expect(canUseManufacturingPermission("quality_inspector", inspectorPermissions, "manufacturing.quality.inspect")).toBe(true);
    expect(canUseManufacturingPermission("quality_inspector", inspectorPermissions, "manufacturing.costs.view")).toBe(false);
    expect(canUseManufacturingPermission("quality_inspector", inspectorPermissions, "manufacturing.reports.export")).toBe(false);
  });

  it("يقيد عامل المخزن ضمن الفرع والخط ومخزني الخام والمنتج النهائي المسموحين", () => {
    const scope = { branchIds: [2], productionLineIds: [5], warehouseIds: [7, 8], rawMaterialWarehouseIds: [7], finishedGoodsWarehouseIds: [8] };
    expect(canAccessManufacturingOrderScope(scope, { branchId: 2, productionLineId: 5, rawMaterialWarehouseId: 7, finishedGoodsWarehouseId: 8 })).toBe(true);
    expect(canAccessManufacturingOrderScope(scope, { branchId: 3, productionLineId: 5, rawMaterialWarehouseId: 7, finishedGoodsWarehouseId: 8 })).toBe(false);
    expect(canAccessManufacturingOrderScope(scope, { branchId: 2, productionLineId: 6, rawMaterialWarehouseId: 7, finishedGoodsWarehouseId: 8 })).toBe(false);
    expect(canAccessManufacturingOrderScope(scope, { branchId: 2, productionLineId: 5, rawMaterialWarehouseId: 9, finishedGoodsWarehouseId: 8 })).toBe(false);
  });
});
