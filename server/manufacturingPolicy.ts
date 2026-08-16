export const productionTransitions = {
  draft: ["planned", "cancelled"],
  planned: ["approved", "cancelled"],
  approved: ["materials_reserved", "cancelled"],
  materials_reserved: ["in_production", "cancelled"],
  in_production: ["quality_hold", "completed"],
  quality_hold: ["completed", "in_production", "cancelled"],
  completed: ["closed"],
  closed: [],
  cancelled: [],
} as const;

export type ProductionStatus = keyof typeof productionTransitions;

export function canTransitionProductionOrder(from: ProductionStatus, to: ProductionStatus) {
  return productionTransitions[from].includes(to as never);
}

export function calculateProductionYield(plannedQuantity: number, goodQuantity: number) {
  if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) throw new Error("الكمية المخططة يجب أن تكون أكبر من صفر.");
  if (!Number.isFinite(goodQuantity) || goodQuantity < 0) throw new Error("كمية المنتج الجيد غير صالحة.");
  return Number(((goodQuantity / plannedQuantity) * 100).toFixed(4));
}

export function calculateUnitProductionCost(input: { materialCost: number; laborCost?: number; overheadCost?: number; goodQuantity: number }) {
  const total = input.materialCost + (input.laborCost ?? 0) + (input.overheadCost ?? 0);
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(input.goodQuantity) || input.goodQuantity <= 0) throw new Error("لا يمكن احتساب تكلفة الوحدة بالقيم الحالية.");
  return Number((total / input.goodQuantity).toFixed(6));
}
