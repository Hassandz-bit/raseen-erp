import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auditLogs, inventoryBalances, productBatches, products, salesInvoiceItems, salesInvoices, stockMovements, warehouses, organizations } from "../drizzle/schema";
import { getDb, issueSalesInvoiceWithFefo } from "./db";

type Fixture = { organizationId: number; productId: number; warehouseId: number; invoiceId: number; batchId: number };
let fixture: Fixture | null = null;

afterEach(async () => {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;
  const { organizationId, productId, warehouseId, invoiceId, batchId } = fixture;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
  await db.delete(stockMovements).where(eq(stockMovements.organizationId, organizationId));
  await db.delete(inventoryBalances).where(eq(inventoryBalances.organizationId, organizationId));
  await db.delete(salesInvoiceItems).where(and(eq(salesInvoiceItems.organizationId, organizationId), eq(salesInvoiceItems.invoiceId, invoiceId)));
  await db.delete(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.id, invoiceId)));
  await db.delete(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, batchId)));
  await db.delete(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.id, warehouseId)));
  await db.delete(products).where(and(eq(products.organizationId, organizationId), eq(products.id, productId)));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  fixture = null;
});

describe("تكامل إصدار الفاتورة مع FEFO", () => {
  it("يبقي الفاتورة مسودة ولا ينشئ حركة مخزون عند كون الدفعة الوحيدة منتهية", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const organization = await db.insert(organizations).values({ name: `اختبار تكامل ${suffix}`, slug: `sales-integration-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const organizationId = Number(organization[0].insertId);
    const product = await db.insert(products).values({ organizationId, name: "منتج اختبار منتهي", sku: `SKU-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" });
    const productId = Number(product[0].insertId);
    const warehouse = await db.insert(warehouses).values({ organizationId, name: "مخزن اختبار", code: `WH-${suffix}`, status: "active" });
    const warehouseId = Number(warehouse[0].insertId);
    const invoice = await db.insert(salesInvoices).values({ organizationId, invoiceNumber: `INV-${suffix}`, status: "draft", grandTotal: "50", amountPaid: "0" });
    const invoiceId = Number(invoice[0].insertId);
    await db.insert(salesInvoiceItems).values({ organizationId, invoiceId, productId, warehouseId, quantity: "5", unit: "قطعة", unitPrice: "10", taxRate: "0", lineTotal: "50" });
    const batch = await db.insert(productBatches).values({ organizationId, productId, warehouseId, lotNumber: `LOT-${suffix}`, receivedQuantity: "5", currentQuantity: "5", reservedQuantity: "0", cost: "5", expiryDate: new Date("2000-01-01T00:00:00Z"), status: "active" });
    const batchId = Number(batch[0].insertId);
    fixture = { organizationId, productId, warehouseId, invoiceId, batchId };

    await expect(issueSalesInvoiceWithFefo(organizationId, 1, invoiceId)).rejects.toThrow("لا توجد كميات صالحة كافية");

    const [savedInvoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.id, invoiceId))).limit(1);
    const movements = await db.select().from(stockMovements).where(and(eq(stockMovements.organizationId, organizationId), eq(stockMovements.sourceDocumentId, invoiceId)));
    const [savedBatch] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, batchId))).limit(1);
    expect(savedInvoice?.status).toBe("draft");
    expect(movements).toHaveLength(0);
    expect(savedBatch?.currentQuantity).toBe("5.000");
  });
});
