import { describe, expect, it } from "vitest";
import { buildManufacturingExcel } from "./manufacturingReportExport";

describe("تصدير تقرير التصنيع", () => {
  it("ينشئ جدولاً قابلاً للتنزيل ويحمي صفوف القيم من محارف الجدولة والأسطر", () => {
    const result = buildManufacturingExcel("تقرير التصنيع", "16/08/2026", [{ label: "إنتاج\nجيد", value: "12\tوحدة" }]);
    expect(result).toContain("تقرير التصنيع");
    expect(result).toContain("Metric\tValue");
    expect(result).toContain("إنتاج جيد\t12 وحدة");
  });
});
