import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl", formatNumber: (value: number) => String(value) }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ erp: { b2b: { management: { orders: { invalidate: vi.fn() }, accesses: { invalidate: vi.fn() } } } } }), erp: { b2b: { management: { orders: { useQuery: () => ({ data: [{ id: 1, orderNumber: "B2B-1", retailerName: "محل النواة", status: "new", accessStatus: "active", totalAmount: "120", currencyCode: "DZD", items: [{ id: 1, productId: 4, unit: "PCS", quantity: "2", unitPrice: "60" }] }], isLoading: false }) }, accesses: { useQuery: () => ({ data: [], isLoading: false }) }, accessStatus: { useMutation: () => ({ mutate: vi.fn() }) }, visibility: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, resendInvite: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, outlets: { list: { useQuery: () => ({ data: [], refetch: vi.fn() }) }, create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, review: { useMutation: () => ({ mutate: vi.fn() }) } } } } }));
import B2BOrders from "./B2BOrders";

describe("B2BOrders", () => {
  it("يعرض طلب المحل وإجراءات الاعتماد والرفض", () => {
    const html = renderToStaticMarkup(<B2BOrders />);
    expect(html).toContain("محل النواة");
    expect(html).toContain("اعتماد وتحويل");
    expect(html).toContain("رفض");
  });
});
