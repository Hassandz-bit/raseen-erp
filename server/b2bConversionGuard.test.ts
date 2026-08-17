import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/b2b.ts"), "utf8");

describe("تحويل طلب Retail إلى Sales Order", () => {
  it("يرفض retry التحويل عندما يوجد Sales Order مرتبط بالفعل", () => {
    expect(source).toContain("eq(salesOrders.b2bOrderId, order.id)");
    expect(source).toContain("تم تحويل طلب B2B هذا إلى Sales Order مسبقاً.");
  });

  it("يوثق تعديل الكمية أو السعر ويشترط سبباً قبل التحويل", () => {
    expect(source).toContain("if (changed.some(line => !line.reason)) throw new Error(\"سبب التعديل مطلوب لكل كمية أو سعر معدل.\")");
    expect(source).toContain("tx.insert(b2bOrderAdjustments)");
    expect(source).toContain("requestedQuantity: line.item.quantity");
    expect(source).toContain("confirmedQuantity: String(line.quantity)");
    expect(source).toContain("action: \"b2b_order.converted_to_sales_order\"");
  });

  it("يحفظ لقطة منفذ التسليم في Sales Order ولا ينشئ دورة توزيع موازية", () => {
    expect(source).toContain("deliveryOutletId: outlet?.id");
    expect(source).toContain("deliveryAddressSnapshot:");
    expect(source).toContain("source: \"b2b\"");
  });
});
