import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const downloadExcel = vi.fn();
const downloadPdf = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl", formatCurrency: (value: number) => `د.ج ${value.toFixed(2)}`, formatNumber: (value: number) => String(value), formatPercentage: (value: number) => `${(value * 100).toFixed(2)}%`, formatDate: () => "16/08/2026" }) }));
vi.mock("@/lib/distributionReportExport", () => ({ downloadDistributionExcel: (...args: unknown[]) => downloadExcel(...args), downloadDistributionPdf: (...args: unknown[]) => downloadPdf(...args) }));
vi.mock("@/lib/trpc", () => ({ trpc: { erp: { distribution: { controlCenter: { useQuery: () => ({ data: { routesToday: 4, activeRoutes: 2, vehiclesLoaded: 1, pendingDeliveries: 3, collections: 1200, returns: 5, capacityUtilization: 0.65 }, isLoading: false, isError: false, refetch: vi.fn() }) }, routes: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }, create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, vehicles: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }, documentAlerts: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }, create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, territories: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }, create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, settings: { get: { useQuery: () => ({ data: { overloadPolicy: "warning" }, isLoading: false, isError: false, refetch: vi.fn() }) } } } } } }));

import Distribution from "./Distribution";

describe("Distribution UI", () => {
  it("يعرض مؤشرات المركز وحالات الفراغ ويصدر جدول Excel", () => {
    render(<Distribution />);
    expect(screen.getByText("الأسطول والجولات في رؤية واحدة")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("لا توجد جولات تشغيلية بعد.")).toBeTruthy();
    expect(screen.getByText("لا توجد وثائق قريبة من الانتهاء.")).toBeTruthy();
    fireEvent.click(screen.getByText("تصدير Excel"));
    expect(downloadExcel).toHaveBeenCalledTimes(1);
  });
});
