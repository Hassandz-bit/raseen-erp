import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl", formatNumber: (value: number) => String(value) }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ erp: { b2b: { orders: { list: { invalidate: vi.fn() } } } } }), erp: { b2b: { accesses: { useQuery: () => ({ data: [], isLoading: false }) }, catalog: { useQuery: () => ({ data: [], isLoading: false }) }, orders: { list: { useQuery: () => ({ data: [] }) }, create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, documents: { useQuery: () => ({ data: [] }) } } } } }));
import Retailer from "./Retailer";

describe("Retailer", () => {
  it("يعرض حالة آمنة عند غياب علاقة وصول B2B", () => {
    const html = renderToStaticMarkup(<Retailer />);
    expect(html).toContain("لا توجد مؤسسة مصرح بها لهذا الحساب");
  });
});
