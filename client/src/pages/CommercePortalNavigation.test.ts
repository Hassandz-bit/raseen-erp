import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getPortal } from "@/config/nawaPortals";

const commercePage = readFileSync(resolve(process.cwd(), "client/src/pages/CommerceInventory.tsx"), "utf8");
const operationsPanel = readFileSync(resolve(process.cwd(), "client/src/components/CommerceOperationsPanel.tsx"), "utf8");
const commerceSectionPage = readFileSync(resolve(process.cwd(), "client/src/pages/CommerceSection.tsx"), "utf8");
const exchangeRatesPanel = readFileSync(resolve(process.cwd(), "client/src/components/ExchangeRatesPanel.tsx"), "utf8");

describe("تنقل بوابة التجارة والمخزون", () => {
  it("يعرض جميع أدوات التجارة والمخزون التشغيلية", () => {
    const ids = getPortal("commerce")?.localNavigation.map(item => item.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining(["products", "warehouses", "batches", "sales", "purchases"]));
  });

  it("يربط الأدوات بصفحات جداول مستقلة قابلة للمتابعة", () => {
    expect(commercePage).toContain("CommerceOperationsPanel");
    expect(operationsPanel).toContain("listWarehouses");
    expect(commerceSectionPage).toContain("listProducts");
    expect(commerceSectionPage).toContain("listBatches");
    expect(commerceSectionPage).toContain("listInvoices");
    expect(commerceSectionPage).toContain("listOrders");
    ["/commerce/products", "/commerce/warehouses", "/commerce/batches", "/commerce/sales", "/commerce/purchases"].forEach(route => expect(getPortal("commerce")?.localNavigation.some(item => item.href === route)).toBe(true));
  });

  it("يعرض أداة تخصيص مستقلة لكل جدول تشغيلي ولتقرير أسعار الصرف", () => {
    expect(commerceSectionPage).toContain("TableViewControls");
    expect(commerceSectionPage).toContain("`commerce.${section}`");
    expect(exchangeRatesPanel).toContain("reports.exchange-rates");
    expect(exchangeRatesPanel).toContain("TableViewControls");
  });
});
