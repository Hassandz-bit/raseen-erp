import { describe, expect, it } from "vitest";
import { buildWorkspaceReportExcel } from "./workspaceReportExport";

describe("تصدير تقرير مساحة العمل", () => {
  it("يبني ملف Excel جدولي ويمنع حقن الفواصل والأسطر من محتوى التقرير", () => {
    const content = buildWorkspaceReportExcel("ملخص المؤسسة", "16/08/2026", [{ label: "صافي\nالربح", value: "12\t000" }]);
    expect(content).toContain("ملخص المؤسسة");
    expect(content).toContain("Generated at: 16/08/2026");
    expect(content).toContain("صافي الربح");
    expect(content).toContain("12 000");
    expect(content).toContain("<col style=\"width:");
  });
});
