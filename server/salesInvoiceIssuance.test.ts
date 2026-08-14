import { describe, expect, it, vi } from "vitest";
import { issueSalesInvoiceWithFefoInTransaction, type CommerceTransaction } from "./db";

function queryResult(value: unknown) {
  const promise = Promise.resolve(value);
  return Object.assign(promise, {
    limit: () => promise,
    orderBy: () => promise,
  });
}

describe("مسار إصدار فاتورة المبيعات", () => {
  it("يرفض الدفعات المنتهية قبل إنشاء أي حركة أو تحديث جزئي", async () => {
    const selections = [
      [{ id: 91, status: "draft" }],
      [{ id: 12, productId: 7, warehouseId: 4, quantity: "5", unit: "قطعة" }],
      [{ id: 41, currentQuantity: "20", reservedQuantity: "0", expiryDate: new Date("2026-08-01T00:00:00Z"), status: "active" }],
    ];
    const update = vi.fn();
    const insert = vi.fn();
    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => queryResult(selections.shift() ?? []),
        }),
      })),
      update,
      insert,
    } as unknown as CommerceTransaction;

    await expect(issueSalesInvoiceWithFefoInTransaction(tx, 1, 3, 91)).rejects.toThrow("لا توجد كميات صالحة كافية");
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
