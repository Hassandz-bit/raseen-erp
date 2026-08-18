import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { businessParties, organizations, products, salesInvoices } from "../drizzle/schema";
import { getDb, searchCommandEntitiesForOrganization } from "./db";

let organizationIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const organizationId of organizationIds) {
    await db.delete(salesInvoices).where(eq(salesInvoices.organizationId, organizationId));
    await db.delete(businessParties).where(eq(businessParties.organizationId, organizationId));
    await db.delete(products).where(eq(products.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  organizationIds = [];
});

describe("بحث شريط الأوامر المعزول", () => {
  it("يعرض فقط سجلات المؤسسة الحالية ويخفي أنواع السجلات عند إيقاف وحدتها", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = await db.insert(organizations).values({ name: `مؤسسة بحث أولى ${suffix}`, slug: `command-first-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const second = await db.insert(organizations).values({ name: `مؤسسة بحث ثانية ${suffix}`, slug: `command-second-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const firstId = Number(first[0].insertId);
    const secondId = Number(second[0].insertId);
    organizationIds.push(firstId, secondId);

    await db.insert(products).values([{ organizationId: firstId, name: `منتج ${suffix}`, sku: `SKU-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" }, { organizationId: secondId, name: `منتج أجنبي ${suffix}`, sku: `SKU-FOREIGN-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" }]);
    await db.insert(businessParties).values([{ organizationId: firstId, name: `عميل ${suffix}`, code: `CUS-${suffix}`, types: ["customer"], status: "active" }, { organizationId: secondId, name: `عميل أجنبي ${suffix}`, code: `CUS-FOREIGN-${suffix}`, types: ["customer"], status: "active" }]);
    await db.insert(salesInvoices).values([{ organizationId: firstId, invoiceNumber: `INV-${suffix}`, status: "draft", grandTotal: "10", amountPaid: "0" }, { organizationId: secondId, invoiceNumber: `INV-FOREIGN-${suffix}`, status: "draft", grandTotal: "20", amountPaid: "0" }]);

    const result = await searchCommandEntitiesForOrganization(firstId, { query: suffix, includeInventory: true, includeSales: true });
    expect(result.products).toEqual([expect.objectContaining({ label: `منتج ${suffix}` })]);
    expect(result.customers).toEqual([expect.objectContaining({ label: `عميل ${suffix}` })]);
    expect(result.invoices).toEqual([expect.objectContaining({ label: `INV-${suffix}` })]);
    expect(JSON.stringify(result)).not.toContain("أجنبي");

    const salesOnly = await searchCommandEntitiesForOrganization(firstId, { query: suffix, includeInventory: false, includeSales: true });
    expect(salesOnly.products).toEqual([]);
    expect(salesOnly.customers).toHaveLength(1);
    expect(salesOnly.invoices).toHaveLength(1);
  }, 20_000);
});
