import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const refreshOverview = vi.fn();
const refreshOrders = vi.fn();

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl", t: (key: string) => key === "status" ? "الحالة" : key }) }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, mutate: vi.fn() }) };
  return { trpc: { erp: { manufacturing: {
    overview: { useQuery: () => ({ data: { planned: 3, inProduction: 1, completed: 2, closed: 0, materialShortages: 0, qualityHold: 0, goodOutputQuantity: 48, wasteQuantity: 2, averageUnitCost: 15.5 }, isLoading: false, isError: false, refetch: refreshOverview }) },
    orders: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: refreshOrders }) },
    capabilities: { useQuery: () => ({ data: { capabilities: { "manufacturing.order.plan": true, "manufacturing.order.approve": true } } }) },
    operationalOptions: { useQuery: () => ({ data: { boms: [], warehouses: [], productionLines: [] } }) },
    orderDetails: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) },
    batchGenealogy: { useQuery: () => ({ data: undefined, isError: false }) },
    createOrder: mutation, transitionOrder: mutation, reserveMaterials: mutation, issueMaterials: mutation, returnMaterials: mutation, updateStage: mutation, recordOutput: mutation, recordWaste: mutation, qualityCheck: mutation, closeOrder: mutation, recordExpense: mutation,
  } } } };
});

import Manufacturing from "./Manufacturing";

describe("Manufacturing UI", () => {
  it("يعرض المؤشرات المعزولة وحالة الفراغ ويعيد تحديث بيانات المركز", () => {
    render(<Manufacturing />);
    expect(screen.getByText("مركز التصنيع والإنتاج")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("لا توجد أوامر إنتاج بعد. أنشئ BOM معتمد ثم ابدأ التخطيط.")).toBeTruthy();
    fireEvent.click(screen.getByText("تحديث المركز"));
    expect(refreshOverview).toHaveBeenCalledTimes(1);
    expect(refreshOrders).toHaveBeenCalledTimes(1);
  });
});
