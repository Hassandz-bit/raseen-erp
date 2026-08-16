import { describe, expect, it } from "vitest";
import { calculateProductionYield, calculateUnitProductionCost, canTransitionProductionOrder } from "./manufacturingPolicy";

describe("manufacturing policy", () => {
  it("يحرس انتقالات أوامر الإنتاج", () => {
    expect(canTransitionProductionOrder("planned", "approved")).toBe(true);
    expect(canTransitionProductionOrder("approved", "in_production")).toBe(false);
    expect(canTransitionProductionOrder("materials_reserved", "in_production")).toBe(true);
    expect(canTransitionProductionOrder("closed", "in_production")).toBe(false);
  });
  it("يحسب العائد والتكلفة على كمية المنتج الجيد", () => {
    expect(calculateProductionYield(100, 92)).toBe(92);
    expect(calculateUnitProductionCost({ materialCost: 80, laborCost: 10, overheadCost: 10, goodQuantity: 50 })).toBe(2);
  });
  it("يرفض عائداً أو تكلفة وحدة لا يمكن احتسابها", () => {
    expect(() => calculateProductionYield(0, 1)).toThrow("الكمية المخططة");
    expect(() => calculateProductionYield(10, -1)).toThrow("كمية المنتج الجيد");
    expect(() => calculateUnitProductionCost({ materialCost: 10, goodQuantity: 0 })).toThrow("لا يمكن احتساب تكلفة الوحدة");
  });
});
