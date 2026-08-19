import { describe, expect, it } from "vitest";
import { buildDistributionExcel } from "./distributionReportExport";

describe("distribution report export", () => {
  it("builds an Excel-compatible report and neutralizes line breaks", () => {
    const output = buildDistributionExcel("تقرير التوزيع", "16/08/2026", [{ label: "جولات\nنشطة", value: "2" }]);
    expect(output).toContain("تقرير التوزيع");
    expect(output).toContain("جولات نشطة");
    expect(output).toContain("<td>2</td>");
    expect(output).toContain("<col style=\"width:");
    expect(output).not.toContain("جولات\nنشطة");
  });
});
