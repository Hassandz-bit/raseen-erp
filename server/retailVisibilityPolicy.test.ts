import { describe, expect, it } from "vitest";
import { resolveVisibilityPolicy } from "./b2b";

describe("Retail visibility policy", () => {
  it("يطبق إفصاحاً آمناً افتراضياً بلا مخزون دقيق أو كشف حساب", () => {
    const policy = resolveVisibilityPolicy({ visibilityPolicy: null });
    expect(policy.stockVisibility).toBe("availability_only");
    expect(policy.showStatement).toBe(false);
    expect(policy.debtVisibility).toBe("total_only");
  });

  it("يحترم حجب الأسعار والعروض والذمم والتتبع لكل علاقة تاجر", () => {
    const policy = resolveVisibilityPolicy({ visibilityPolicy: { showPrices: false, showPromotions: false, debtVisibility: "hidden", deliveryTracking: "off" } });
    expect(policy.showPrices).toBe(false);
    expect(policy.showPromotions).toBe(false);
    expect(policy.debtVisibility).toBe("hidden");
    expect(policy.deliveryTracking).toBe("off");
  });
});
