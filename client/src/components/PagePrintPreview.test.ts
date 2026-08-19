import { describe, expect, it } from "vitest";
import { buildPrintPageRule, PRINT_PAPER_OPTIONS } from "./PagePrintPreview";

describe("معاينة طباعة الصفحة", () => {
  it("تدعم أحجام ورق التقارير الأساسية", () => {
    expect(PRINT_PAPER_OPTIONS).toEqual(["A4", "A5", "letter"]);
  });

  it("تنشئ قاعدة صفحة صحيحة لاتجاه الطباعة المختار", () => {
    expect(buildPrintPageRule("A4", "landscape")).toContain("size: A4 landscape");
    expect(buildPrintPageRule("A5", "portrait")).toContain("size: A5 portrait");
  });
});
