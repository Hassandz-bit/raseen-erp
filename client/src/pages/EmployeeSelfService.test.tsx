import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayslipList } from "./EmployeeSelfService";

const downloadPdf = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/distributionReportExport", () => ({ downloadDistributionPdf: (...args: unknown[]) => downloadPdf(...args) }));

describe("بوابة الموظف الذاتية", () => {
  it("تعرض قسيمة الموظف وحده مع تنزيل PDF وطباعة", async () => {
    render(<PayslipList title="قسائم راتبي" empty="فارغ" direction="rtl" employeeName="موظف الاختبار" labels={{ attendance: "حضوري", payslips: "قسائم راتبي", payslip: "قسيمة راتب", base: "الراتب الأساسي", allowances: "البدلات", overtime: "الإضافي", bonuses: "المكافآت", deductions: "الخصومات", advanceRecovery: "استرداد السلفة", gross: "الإجمالي", net: "الصافي", pdf: "تنزيل PDF", print: "طباعة" }} rows={[{ periodName: "أغسطس 2026", documentNumber: "PS-1-1", status: "paid", currencyCode: "SAR", snapshot: { baseSalary: 1000, netPay: 900 } }]} />);
    expect(screen.getByText("قسائم راتبي")).toBeTruthy();
    expect(screen.getByText(/PS-1-1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تنزيل PDF" }));
    await waitFor(() => expect(downloadPdf).toHaveBeenCalledWith(expect.objectContaining({ title: "قسيمة راتب", amount: "900.00 SAR" }), "nawa-payslip-PS-1-1.pdf"));
    expect(screen.getByRole("button", { name: "طباعة" })).toBeTruthy();
  });

  it("لا يعرض طباعة أو PDF عند غياب أي كشف راتب", () => {
    const view = render(<PayslipList title="قسائم راتبي" empty="فارغ" direction="rtl" employeeName="موظف الاختبار" labels={{ attendance: "حضوري", payslips: "قسائم راتبي", payslip: "قسيمة راتب", base: "الراتب الأساسي", allowances: "البدلات", overtime: "الإضافي", bonuses: "المكافآت", deductions: "الخصومات", advanceRecovery: "استرداد السلفة", gross: "الإجمالي", net: "الصافي", pdf: "تنزيل PDF", print: "طباعة" }} rows={[]} />);
    const scope = within(view.container);
    expect(scope.getByText("فارغ")).toBeTruthy();
    expect(scope.queryByRole("button", { name: "تنزيل PDF" })).toBeNull();
    expect(scope.queryByRole("button", { name: "طباعة" })).toBeNull();
  });
});
