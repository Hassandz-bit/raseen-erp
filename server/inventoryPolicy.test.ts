import { describe, expect, it } from "vitest";
import { canTransitionSalesDocument, convertUnitQuantity, selectFefoBatches } from "./inventoryPolicy";

describe("inventory policy", () => {
  it("allocates FEFO while blocking expired and quarantined batches", () => {
    const now = new Date("2026-08-14T00:00:00Z");
    const result = selectFefoBatches([
      { id: 1, availableQuantity: 8, expiryDate: new Date("2026-08-20"), status: "active" },
      { id: 2, availableQuantity: 9, expiryDate: new Date("2026-08-16"), status: "active" },
      { id: 3, availableQuantity: 99, expiryDate: new Date("2026-08-01"), status: "active" },
      { id: 4, availableQuantity: 99, expiryDate: new Date("2026-08-15"), status: "quarantined" },
    ], 12, now);
    expect(result.allocations).toEqual([{ batchId: 2, quantity: 9 }, { batchId: 1, quantity: 3 }]);
    expect(result.remainingQuantity).toBe(0);
  });

  it("converts UOM and guards sales transitions", () => {
    expect(convertUnitQuantity(3, 12)).toBe(36);
    expect(() => convertUnitQuantity(3, 0)).toThrow();
    expect(canTransitionSalesDocument("draft", "confirmed")).toBe(true);
    expect(canTransitionSalesDocument("paid", "cancelled")).toBe(false);
  });

  it("reports a shortage when active non-expired batches cannot satisfy issuance", () => {
    const result = selectFefoBatches([
      { id: 1, availableQuantity: 2, expiryDate: new Date("2026-08-20"), status: "active" },
      { id: 2, availableQuantity: 12, expiryDate: new Date("2026-08-01"), status: "active" },
    ], 5, new Date("2026-08-14"));
    expect(result.allocations).toEqual([{ batchId: 1, quantity: 2 }]);
    expect(result.remainingQuantity).toBe(3);
  });
});
