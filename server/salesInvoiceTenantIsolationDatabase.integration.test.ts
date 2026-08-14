import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { organizations, productBatches, products, salesInvoiceItems, salesInvoices, stockMovements, warehouses } from "../drizzle/schema";
import { getDb, issueSalesInvoiceWithFefo } from "./db";

type Fixture = { organizationId: number; productId?: number; warehouseId?: number; batchId?: number; invoiceId?: number };
let fixtures: Fixture[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const fixture of fixtures) {
    await db.delete(stockMovements).where(eq(stockMovements.organizationId, fixture.organizationId));
    if (fixture.invoiceId) await db.delete(salesInvoiceItems).where(and(eq(salesInvoiceItems.organizationId, fixture.organizationId), eq(salesInvoiceItems.invoiceId, fixture.invoiceId)));
    if (fixture.invoiceId) await db.delete(salesInvoices).where(and(eq(salesInvoices.organizationId, fixture.organizationId), eq(salesInvoices.id, fixture.invoiceId)));
    if (fixture.productId) await db.delete(productBatches).where(and(eq(productBatches.organizationId, fixture.organizationId), eq(productBatches.productId, fixture.productId)));
    if (fixture.warehouseId) await db.delete(warehouses).where(and(eq(warehouses.organizationId, fixture.organizationId), eq(warehouses.id, fixture.warehouseId)));
    if (fixture.productId) await db.delete(products).where(and(eq(products.organizationId, fixture.organizationId), eq(products.id, fixture.productId)));
    await db.delete(organizations).where(eq(organizations.id, fixture.organizationId));
  }
  fixtures = [];
});

describe("عزل FEFO بين المؤسسات", () => {
  it("يرفض إصدار فاتورة مؤسسة ثانية ولا يخصم أي كمية من دفعاتها", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = await db.insert(organizations).values({ name: `مؤسسة أولى ${suffix}`, slug: `fefo-one-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const firstOrganizationId = Number(first[0].insertId);
    fixtures.push({ organizationId: firstOrganizationId });
    const second = await db.insert(organizations).values({ name: `مؤسسة ثانية ${suffix}`, slug: `fefo-two-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const secondOrganizationId = Number(second[0].insertId);
    const product = await db.insert(products).values({ organizationId: secondOrganizationId, name: "منتج عزل FEFO", sku: `SKU-FEFO-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" });
    const productId = Number(product[0].insertId);
    const warehouse = await db.insert(warehouses).values({ organizationId: secondOrganizationId, name: "مخزن عزل FEFO", code: `WH-FEFO-${suffix}`, status: "active" });
    const warehouseId = Number(warehouse[0].insertId);
    const invoice = await db.insert(salesInvoices).values({ organizationId: secondOrganizationId, invoiceNumber: `INV-FEFO-${suffix}`, status: "draft", grandTotal: "10", amountPaid: "0" });
    const invoiceId = Number(invoice[0].insertId);
    await db.insert(salesInvoiceItems).values({ organizationId: secondOrganizationId, invoiceId, productId, warehouseId, quantity: "1", unit: "قطعة", unitPrice: "10", taxRate: "0", lineTotal: "10" });
    const batch = await db.insert(productBatches).values({ organizationId: secondOrganizationId, productId, warehouseId, lotNumber: `LOT-FEFO-${suffix}`, receivedQuantity: "2", currentQuantity: "2", reservedQuantity: "0", cost: "2", expiryDate: new Date("2030-01-01T00:00:00Z"), status: "active" });
    const batchId = Number(batch[0].insertId);
    fixtures.push({ organizationId: secondOrganizationId, productId, warehouseId, batchId, invoiceId });

    await expect(issueSalesInvoiceWithFefo(firstOrganizationId, 1, invoiceId)).rejects.toThrow("فاتورة المبيعات غير متاحة ضمن المؤسسة الحالية");

    const [savedInvoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, secondOrganizationId), eq(salesInvoices.id, invoiceId))).limit(1);
    const [savedBatch] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, secondOrganizationId), eq(productBatches.id, batchId))).limit(1);
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.organizationId, secondOrganizationId));
    expect(savedInvoice?.status).toBe("draft");
    expect(savedBatch?.currentQuantity).toBe("2.000");
    expect(movements).toHaveLength(0);
  });
});
