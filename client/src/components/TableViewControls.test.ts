import { describe, expect, it } from "vitest";
import { normalizeTableView } from "./TableViewControls";

describe("تفضيلات عرض الجداول", () => {
  const columns = [{ id: "select", label: "اختيار", locked: true }, { id: "name", label: "الاسم" }, { id: "price", label: "السعر" }];

  it("يبقي الأعمدة الثابتة ظاهرة ويعيد أي عمود غائب إلى الترتيب", () => {
    const view = normalizeTableView(columns, { density: "compact", hiddenColumnIds: ["select", "price", "unknown"], columnOrder: ["price", "unknown"] });
    expect(view.density).toBe("compact");
    expect(view.hiddenColumnIds).toEqual(["price"]);
    expect(view.columnOrder).toEqual(["price", "select", "name"]);
  });

  it("يستخدم الكثافة العادية عند عدم وجود تفضيل محفوظ", () => {
    expect(normalizeTableView(columns)).toMatchObject({ density: "normal", columnOrder: ["select", "name", "price"], hiddenColumnIds: [] });
  });
});
