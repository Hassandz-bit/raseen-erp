export const manufacturingPermissions = [
  "manufacturing.view", "manufacturing.bom.create", "manufacturing.bom.edit", "manufacturing.bom.activate",
  "manufacturing.order.create", "manufacturing.order.plan", "manufacturing.order.approve", "manufacturing.order.start", "manufacturing.order.complete", "manufacturing.order.close", "manufacturing.order.reopen",
  "manufacturing.materials.reserve", "manufacturing.materials.issue", "manufacturing.materials.return",
  "manufacturing.consumption.record", "manufacturing.output.record", "manufacturing.waste.record", "manufacturing.scrap.record", "manufacturing.rework.record",
  "manufacturing.quality.inspect", "manufacturing.quality.approve", "manufacturing.batch.release",
  "manufacturing.costs.view", "manufacturing.costs.edit", "manufacturing.reports.view", "manufacturing.reports.export",
] as const;

export type ManufacturingPermission = (typeof manufacturingPermissions)[number];

export type ManufacturingDataScope = {
  branchIds?: number[];
  productionLineIds?: number[];
  warehouseIds?: number[];
  rawMaterialWarehouseIds?: number[];
  finishedGoodsWarehouseIds?: number[];
} | null | undefined;

export const manufacturingRolePresets = {
  production_manager: ["manufacturing.view", "manufacturing.bom.create", "manufacturing.bom.edit", "manufacturing.bom.activate", "manufacturing.order.create", "manufacturing.order.plan", "manufacturing.order.approve", "manufacturing.order.start", "manufacturing.order.complete", "manufacturing.order.close", "manufacturing.order.reopen", "manufacturing.materials.reserve", "manufacturing.materials.issue", "manufacturing.materials.return", "manufacturing.consumption.record", "manufacturing.output.record", "manufacturing.waste.record", "manufacturing.scrap.record", "manufacturing.rework.record", "manufacturing.quality.inspect", "manufacturing.quality.approve", "manufacturing.batch.release", "manufacturing.costs.view", "manufacturing.costs.edit", "manufacturing.reports.view", "manufacturing.reports.export"],
  production_supervisor: ["manufacturing.view", "manufacturing.order.plan", "manufacturing.order.start", "manufacturing.order.complete", "manufacturing.consumption.record", "manufacturing.output.record", "manufacturing.waste.record", "manufacturing.scrap.record", "manufacturing.rework.record", "manufacturing.reports.view"],
  warehouse_operator: ["manufacturing.view", "manufacturing.materials.reserve", "manufacturing.materials.issue", "manufacturing.materials.return"],
  quality_inspector: ["manufacturing.view", "manufacturing.quality.inspect", "manufacturing.quality.approve", "manufacturing.batch.release"],
  cost_controller: ["manufacturing.view", "manufacturing.costs.view", "manufacturing.costs.edit", "manufacturing.reports.view", "manufacturing.reports.export"],
} as const satisfies Record<string, readonly ManufacturingPermission[]>;

export function canUseManufacturingPermission(roleKey: string, permissions: string[] | undefined, permission: ManufacturingPermission) {
  return roleKey === "owner" || permissions?.includes("*") || permissions?.includes(permission) || permissions?.includes("manufacturing.*") || false;
}

export function isManufacturingScopeAllowed(scope: ManufacturingDataScope, key: "branchIds" | "productionLineIds" | "warehouseIds" | "rawMaterialWarehouseIds" | "finishedGoodsWarehouseIds", id: number | undefined) {
  if (!id) return true;
  const allowed = scope?.[key];
  return !allowed?.length || allowed.includes(id);
}

export function canAccessManufacturingOrderScope(scope: ManufacturingDataScope, order: { branchId?: number | null; productionLineId?: number | null; rawMaterialWarehouseId: number; finishedGoodsWarehouseId: number }) {
  return isManufacturingScopeAllowed(scope, "branchIds", order.branchId ?? undefined)
    && isManufacturingScopeAllowed(scope, "productionLineIds", order.productionLineId ?? undefined)
    && isManufacturingScopeAllowed(scope, "warehouseIds", order.rawMaterialWarehouseId)
    && isManufacturingScopeAllowed(scope, "warehouseIds", order.finishedGoodsWarehouseId)
    && isManufacturingScopeAllowed(scope, "rawMaterialWarehouseIds", order.rawMaterialWarehouseId)
    && isManufacturingScopeAllowed(scope, "finishedGoodsWarehouseIds", order.finishedGoodsWarehouseId);
}
