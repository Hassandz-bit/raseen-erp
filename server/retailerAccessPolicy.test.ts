import { describe, expect, it } from "vitest";
import { canUseRetailerPermission, isOutletAllowedForRetailer } from "./retailerAccessPolicy";

describe("Retailer roles and outlet scope", () => {
  it("يحصر المشتري في الكتالوج والطلب ولا يمنحه الذمم أو كشف الحساب", () => {
    expect(canUseRetailerPermission("buyer", null, "retail.orders.create")).toBe(true);
    expect(canUseRetailerPermission("buyer", null, "retail.debt.view")).toBe(false);
    expect(canUseRetailerPermission("buyer", null, "retail.statement.view")).toBe(false);
  });

  it("يمنح المحاسب الوثائق والذمم ولا يمنحه إنشاء الطلب", () => {
    expect(canUseRetailerPermission("accountant", null, "retail.invoices.view")).toBe(true);
    expect(canUseRetailerPermission("accountant", null, "retail.orders.create")).toBe(false);
  });

  it("يمنع مدير المتجر من استخدام Outlet خارج نطاقه ويبقي المالك غير مقيد", () => {
    expect(isOutletAllowedForRetailer("store_manager", [11], 11)).toBe(true);
    expect(isOutletAllowedForRetailer("store_manager", [11], 12)).toBe(false);
    expect(isOutletAllowedForRetailer("owner", [11], 12)).toBe(true);
  });
});
