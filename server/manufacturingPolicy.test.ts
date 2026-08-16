import { describe, expect, it } from "vitest";
import { calculateProductionYield, calculateUnitProductionCost, canTransitionProductionOrder } from "./manufacturingPolicy";

describe("manufacturing policy", () => {
  it("يحرس انتقالات أوامر الإنتاج", () => {
    expect(canTransitionProductionOrder("planned", "approved")).toBe(true);
    expect(canTransitionProductionOrder("closed", "in_production")).toBe(false);
  });
  it("يحسب العائد والتكلفة على كمية المنتج الجيد", () => {
    expect(calculateProductionYield(100, 92)).toBe(92);
    expect(calculateUnitProductionCost({ materialCost: 80, laborCost: 10, overheadCost: 10, goodQuantity: 50 })).toBe(2);
  });
});
