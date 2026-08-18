import { describe, expect, it } from "vitest";
import { DEMO_ORGANIZATION } from "./demo";

describe("شركة Nawa Demo", () => {
  it("تستخدم معرفاً ثابتاً ووحدات كاملة وبيانات عملة محلية", () => {
    expect(DEMO_ORGANIZATION.slug).toBe("nawa-demo");
    expect(DEMO_ORGANIZATION.name).toContain("نواة");
    expect(DEMO_ORGANIZATION.moduleKeys).toEqual(expect.arrayContaining(["inventory", "manufacturing", "distribution", "nawa_retail", "finance", "hr"]));
  });

  it("تجهز أدواراً تشغيلية من دون حسابات أو كلمات مرور تجريبية", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("DEMO_ROLES");
    expect(source).toContain("sales_manager");
    expect(source).toContain("warehouse_manager");
    expect(source).toContain("driver");
    expect(source).not.toContain("password");
  });

  it("تحدد فروعاً ومخازن منفصلة قابلة لإعادة التهيئة", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("DEMO-HQ");
    expect(source).toContain("DEMO-CENTRAL");
    expect(source).toContain("demo.foundation.seeded");
  });

  it("يتطلب حذف بيانات العرض عبارة تأكيد صريحة", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain('confirmation !== "DELETE NAWA DEMO"');
    expect(source).toContain('organization.isDemo !== "yes"');
    expect(source).toContain("information_schema.columns");
  });

  it("يبني كتالوجاً مترابطاً من 30 منتجاً وتغليف ووحدات", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("DEMO_CATALOG");
    expect(source).toContain("productPackagingLevels");
    expect(source).toContain("productUnitConversions");
    expect(source).toContain("demo.catalog.seeded");
  });

  it("يجهز عروضاً فعالة وقريبة الانتهاء ومنتهية لمحرك B2B", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("seedDemoPromotions");
    expect(source).toContain("b2bPromotions");
    expect(source).toContain("buy_x_get_y");
    expect(source).toContain("demo.promotions.seeded");
  });

  it("ينشئ سيناريوهات التجارة عبر FEFO والفاتورة والتحصيل والاستلام الجزئي", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("seedDemoCommerceScenarios");
    expect(source).toContain("issueSalesInvoiceWithFefo");
    expect(source).toContain("recordSalesInvoicePayment");
    expect(source).toContain("receivePurchaseOrder");
    expect(source).toContain("INV-DEMO-OVERDUE-001");
  });

  it("يستكمل التصنيع والجودة والتوزيع بأمان عند إعادة تشغيل بيانات العرض", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./demo.ts", import.meta.url), "utf8"));
    expect(source).toContain("seedDemoOperationsScenarios");
    expect(source).toContain("ensureProductionOrder");
    expect(source).toContain("advanceToProduction");
    expect(source).toContain("recordProductionQualityCheck");
    expect(source).toContain("recordDistributionDelivery");
    expect(source).toContain("RTE-DEMO-001");
    expect(source).toContain("DEMO-TRK-01");
  });
});
