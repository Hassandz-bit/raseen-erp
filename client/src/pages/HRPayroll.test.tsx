import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HRPayroll from "./HRPayroll";

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl" }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    erp: { hr: {
      dashboard: { useQuery: () => ({ data: { totalEmployees: 4, activeEmployees: 3, presentToday: 2, absentToday: 1, onLeave: 1 } }) },
      directory: { useQuery: () => ({ data: [] }) },
      operations: { useQuery: () => ({ data: { leaves: [], overtime: [] } }) },
      payrollDashboard: { useQuery: () => ({ data: { totals: { gross: 0, net: 0, outstandingAdvances: 0 }, periods: [] } }) },
      exportBankFile: { useQuery: () => ({ isFetching: false, refetch: vi.fn() }) },
    } },
    useUtils: () => ({}),
  },
}));

describe("مركز HR والرواتب", () => {
  it("يعرض مؤشرات الموارد البشرية وتبويبات التشغيل ورسالة سرية الأجور", () => { render(<HRPayroll />); expect(screen.getByText("مركز الموارد البشرية والرواتب")).toBeTruthy(); expect(screen.getByText("إجمالي الموظفين")).toBeTruthy(); expect(screen.getByText("الموظفون")).toBeTruthy(); expect(screen.getByText("بيانات الرواتب والرواتب الصافية لا تظهر هنا إلا عبر صلاحيات HR/Payroll الخادمية الصريحة.")).toBeTruthy(); });
});
