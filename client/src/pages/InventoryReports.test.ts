import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/InventoryReports.tsx"), "utf8");

describe("تقارير المخزون القابلة للطباعة", () => {
  it("يبني التقرير من بيانات المنتجات والمخازن والدفعات الحالية", () => {
    expect(source).toContain("trpc.erp.inventory.listProducts.useQuery");
    expect(source).toContain("trpc.erp.inventory.listWarehouses.useQuery");
    expect(source).toContain("trpc.erp.inventory.listBatches.useQuery");
    expect(source).toContain("isReportReady");
  });

  it("يوفر حفظ PDF وطباعة سياقيين بعد اكتمال بيانات التقرير", () => {
    expect(source).toContain("downloadDistributionPdf");
    expect(source).toContain("buildDocumentPreviewHtml");
    expect(source).toContain("window.open");
    expect(source).toContain("disabled={!isReportReady}");
  });
});
