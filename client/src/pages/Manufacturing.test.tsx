import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const refreshOverview = vi.fn();
const refreshOrders = vi.fn();
let mockCapabilities: Record<string, boolean> = { "manufacturing.order.plan": true, "manufacturing.order.approve": true, "manufacturing.order.create": true, "manufacturing.reports.export": true };
let mockOrders: Array<Record<string, unknown>> = [];
let mockDetails: Record<string, unknown> | undefined;

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl", t: (key: string) => key === "status" ? "الحالة" : key }) }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, mutate: vi.fn() }) };
  return { trpc: { erp: { manufacturing: {
    overview: { useQuery: () => ({ data: { planned: 3, inProduction: 1, completed: 2, closed: 0, materialShortages: 0, qualityHold: 0, goodOutputQuantity: 48, wasteQuantity: 2, averageUnitCost: 15.5 }, isLoading: false, isError: false, refetch: refreshOverview }) },
    orders: { useQuery: () => ({ data: mockOrders, isLoading: false, isError: false, refetch: refreshOrders }) },
    capabilities: { useQuery: () => ({ data: { capabilities: mockCapabilities } }) },
    operationalOptions: { useQuery: () => ({ data: { boms: [], warehouses: [], productionLines: [], responsibleUsers: [{ userId: 7, name: "مشرف الإنتاج", roleKey: "production_supervisor" }] } }) },
    orderDetails: { useQuery: () => ({ data: mockDetails, isLoading: false, refetch: vi.fn() }) },
    batchGenealogy: { useQuery: () => ({ data: undefined, isError: false }) },
    createOrder: mutation, transitionOrder: mutation, reserveMaterials: mutation, issueMaterials: mutation, returnMaterials: mutation, updateStage: mutation, recordOutput: mutation, recordWaste: mutation, qualityCheck: mutation, closeOrder: mutation, recordExpense: mutation,
  } } } };
});

import Manufacturing from "./Manufacturing";

describe("Manufacturing UI", () => {
  it("يعرض المؤشرات المعزولة وحالة الفراغ ويعيد تحديث بيانات المركز", () => {
    mockOrders = [];
    mockDetails = undefined;
    mockCapabilities = { "manufacturing.order.plan": true, "manufacturing.order.approve": true, "manufacturing.order.create": true, "manufacturing.reports.export": true };
    render(<Manufacturing />);
    expect(screen.getByText("مركز التصنيع والإنتاج")).toBeTruthy();
    expect(screen.getByText("أمر إنتاج جديد")).toBeTruthy();
    expect(screen.getByText("exportSpreadsheet")).toBeTruthy();
    expect(screen.getByText("downloadPdf")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("لا توجد أوامر إنتاج بعد. أنشئ BOM معتمد ثم ابدأ التخطيط.")).toBeTruthy();
    fireEvent.click(screen.getByText("تحديث المركز"));
    expect(refreshOverview).toHaveBeenCalledTimes(1);
    expect(refreshOrders).toHaveBeenCalledTimes(1);
  });

  it("يخفي الإنشاء والتصدير عند غياب الصلاحيات", () => {
    cleanup();
    mockCapabilities = { "manufacturing.order.plan": true };
    render(<Manufacturing />);
    expect(screen.queryByText("أمر إنتاج جديد")).toBeNull();
    expect(screen.queryByText("exportSpreadsheet")).toBeNull();
    expect(screen.queryByText("downloadPdf")).toBeNull();
  });

  it("يعرض لوحة المرحلة واستهلاكها الفعلي لمستخدم تشغيل مصرح له", () => {
    cleanup();
    mockCapabilities = { "manufacturing.order.start": true, "manufacturing.order.complete": true, "manufacturing.order.create": true, "manufacturing.reports.export": true };
    mockOrders = [{ id: 9, orderNumber: "MO-009", plannedQuantity: "10", plannedUnit: "KG", status: "in_production" }];
    mockDetails = { order: { id: 9, orderNumber: "MO-009", plannedQuantity: "10", plannedUnit: "KG", status: "in_production", bomVersion: "1", rawMaterialWarehouseId: 1, finishedGoodsWarehouseId: 2 }, reservations: [{ id: 1, productId: 2, requiredQuantity: "10", availableQuantity: "10", reservedQuantity: "10", issuedQuantity: "8", returnedQuantity: "1", consumedQuantity: "7", shortageQuantity: "0" }], stages: [{ id: 1, sequence: 1, name: "الخلط", code: "MIX", status: "pending", responsibleUserId: null, notes: null, actualStart: null }], outputs: [], expenses: [], audit: [], canViewCosts: false };
    render(<Manufacturing />);
    fireEvent.click(screen.getByText("MO-009"));
    expect(screen.getByText("تشغيل المراحل والمسؤوليات")).toBeTruthy();
    expect(screen.getByText(/الاستهلاك الفعلي/)).toBeTruthy();
    expect(screen.getByText(/الخلط/)).toBeTruthy();
  });
});
