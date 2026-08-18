import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl" }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ erp: { finance: { chartOfAccounts: { invalidate: vi.fn() }, setup: { invalidate: vi.fn() } } } }),
    erp: { finance: {
      chartOfAccounts: { useQuery: () => ({ data: [{ id: 1, code: "1001", nameAr: "الصندوق", status: "active" }] }) },
      journalEntries: { useQuery: () => ({ data: [{ id: 1, journalNumber: "JE-001", status: "posted", entryDate: new Date("2026-08-17T00:00:00Z"), reference: "INV-001" }] }) },
      aging: { receivables: { useQuery: () => ({ data: { totals: { current: 100, "1_30": 20, "31_60": 0, "61_90": 0, "90_plus": 0 } } }) }, payables: { useQuery: () => ({ data: { totals: { current: 50, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 } } }) } },
      treasury: { list: { useQuery: () => ({ data: { cashboxes: [{ id: 1, code: "MAIN", name: "الصندوق الرئيسي", balance: 80 }], banks: [] } }) } },
      reports: { trialBalance: { useQuery: () => ({ data: { lines: [] } }) }, profitAndLoss: { useQuery: () => ({ data: { netProfit: 0 } }) }, balanceSheet: { useQuery: () => ({ data: { totals: { assets: 0 } } }) }, cashFlow: { useQuery: () => ({ data: { netCashFlow: 0 } }) }, generalLedger: { useQuery: () => ({ data: [] }) } },
      reconciliations: { list: { useQuery: () => ({ data: { banks: [], cash: [] } }) } },
      planning: { costCenters: { useQuery: () => ({ data: [] }) }, budgets: { useQuery: () => ({ data: [] }) }, budgetVsActual: { useQuery: () => ({ data: { lines: [] } }) } },
      bootstrap: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    } },
  },
}));

import Finance from "./Finance";

afterEach(() => cleanup());

describe("مركز المالية", () => {
  it("يعرض المؤشرات المالية والإجراء التشغيلي من دون تنقل تبويبات مكرر", () => {
    render(<Finance />);
    expect(screen.getByText("مركز المالية والمحاسبة")).toBeTruthy();
    expect(screen.getByText("ذمم مدينة")).toBeTruthy();
    expect(screen.getByRole("button", { name: "تهيئة نواة المالية" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "دليل الحسابات" })).toBeNull();
  });
});
