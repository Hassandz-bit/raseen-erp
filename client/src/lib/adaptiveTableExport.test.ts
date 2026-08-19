import { describe, expect, it } from "vitest";
import { buildAdaptiveExcelHtml } from "./adaptiveTableExport";

describe("تصدير الجداول المتكيف", () => {
  it("يضبط العرض وفق أطول قيمة وينظف فواصل الأسطر قبل إنشاء جدول Excel", () => {
    const output = buildAdaptiveExcelHtml({ title: "تقرير", generatedAt: "2026-08-19", headers: ["البند", "القيمة"], rows: [["نص\nطويل", "123456789"]] });
    expect(output).toContain('<col style="width:');
    expect(output).toContain("نص طويل");
    expect(output).not.toContain("نص\nطويل");
    expect(output).toContain("<th>البند</th>");
  });
});
