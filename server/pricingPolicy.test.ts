import { describe, expect, it } from "vitest";
import { resolveCommercePrice } from "./pricingPolicy";

describe("commerce pricing priority", () => {
  it("resolves promotion before customer and default price while respecting validity", () => {
    const selected = resolveCommercePrice([
      { kind: "default", price: 100, minimumQuantity: 1, priority: 100 },
      { kind: "customer", price: 90, minimumQuantity: 1, priority: 10 },
      { kind: "promotion", price: 80, minimumQuantity: 1, priority: 1, startsAt: new Date("2026-08-01"), endsAt: new Date("2026-08-31") },
    ], 2, new Date("2026-08-14"));
    expect(selected?.price).toBe(80);
  });
});
