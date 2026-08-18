import { getPortalNavigationIcon } from "@/config/nawaPortals";
import { Boxes, FileText, PackageSearch, ReceiptText, Warehouse } from "lucide-react";
import { describe, expect, it } from "vitest";

describe("تفاصيل التجارة والإجراء الجماعي", () => {
  it("يحافظ على أيقونات مميزة لأدوات الكتالوج والمخزون والمبيعات", () => {
    expect(getPortalNavigationIcon("products", Boxes)).toBe(Boxes);
    expect(getPortalNavigationIcon("warehouses", Boxes)).toBe(Warehouse);
    expect(getPortalNavigationIcon("batches", Boxes)).toBe(PackageSearch);
    expect(getPortalNavigationIcon("sales", Boxes)).toBe(ReceiptText);
    expect(getPortalNavigationIcon("details", Boxes)).toBe(FileText);
  });
});
