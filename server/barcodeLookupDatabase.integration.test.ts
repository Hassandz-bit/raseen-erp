import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { organizations, products } from "../drizzle/schema";
import { findProductByBarcodeForOrganization, getDb } from "./db";

let organizationIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const organizationId of organizationIds) {
    await db.delete(products).where(eq(products.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  organizationIds = [];
});

describe("بحث المنتج بالباركود وQR", () => {
  it("يعيد منتج المؤسسة الحالية فقط حتى عند استخدام الرمز نفسه في مؤسسة ثانية", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = await db.insert(organizations).values({ name: `مؤسسة ماسح أولى ${suffix}`, slug: `scanner-first-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const second = await db.insert(organizations).values({ name: `مؤسسة ماسح ثانية ${suffix}`, slug: `scanner-second-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const firstId = Number(first[0].insertId);
    const secondId = Number(second[0].insertId);
    organizationIds.push(firstId, secondId);
    const barcode = `QR-${suffix}`;
    await db.insert(products).values([{ organizationId: firstId, name: "منتج المؤسسة الأولى", sku: `SKU-FIRST-${suffix}`, barcode, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" }, { organizationId: secondId, name: "منتج المؤسسة الثانية", sku: `SKU-SECOND-${suffix}`, barcode, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" }]);

    const firstMatch = await findProductByBarcodeForOrganization(firstId, `  ${barcode}  `);
    const secondMatch = await findProductByBarcodeForOrganization(secondId, barcode);

    expect(firstMatch).toMatchObject({ name: "منتج المؤسسة الأولى", barcode });
    expect(secondMatch).toMatchObject({ name: "منتج المؤسسة الثانية", barcode });
  }, 20_000);

  it("يرفض الرمز غير المتوافق مع سياسة الباركود", async () => {
    await expect(findProductByBarcodeForOrganization(1, "bad@code")).rejects.toThrow("صيغة الباركود أو رمز QR غير صالحة");
  });
});
