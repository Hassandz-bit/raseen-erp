import { describe, expect, it } from "vitest";
import { buildDistributionExcel } from "./distributionReportExport";

describe("distribution report export", () => {
  it("builds an Excel-compatible report and neutralizes line breaks", () => {
    const output = buildDistributionExcel("تقرير التوزيع", "16/08/2026", [{ label: "جولات\nنشطة", value: "2" }]);
    expect(output).toContain("تقرير التوزيع");
    expect(output).toContain("جولات نشطة\t2");
    expect(output).not.toContain("جولات\nنشطة");
  });
});
