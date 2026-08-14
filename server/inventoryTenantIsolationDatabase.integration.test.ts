import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auditLogs, inventoryCountItems, inventoryCounts, organizations, productBatches, products, stockTransferItems, stockTransfers, warehouses } from "../drizzle/schema";
import { createInventoryCount, createStockTransfer, getDb, startInventoryCount, submitInventoryCount } from "./db";

type OrganizationFixture = { organizationId: number; productId: number; warehouseIds: number[]; batchId: number; countId?: number };
let fixtures: OrganizationFixture[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const fixture of fixtures) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, fixture.organizationId));
    if (fixture.countId) await db.delete(inventoryCountItems).where(and(eq(inventoryCountItems.organizationId, fixture.organizationId), eq(inventoryCountItems.countId, fixture.countId)));
    if (fixture.countId) await db.delete(inventoryCounts).where(and(eq(inventoryCounts.organizationId, fixture.organizationId), eq(inventoryCounts.id, fixture.countId)));
    await db.delete(stockTransferItems).where(eq(stockTransferItems.organizationId, fixture.organizationId));
    await db.delete(stockTransfers).where(eq(stockTransfers.organizationId, fixture.organizationId));
    await db.delete(productBatches).where(and(eq(productBatches.organizationId, fixture.organizationId), eq(productBatches.productId, fixture.productId)));
    for (const warehouseId of fixture.warehouseIds) await db.delete(warehouses).where(and(eq(warehouses.organizationId, fixture.organizationId), eq(warehouses.id, warehouseId)));
    await db.delete(products).where(and(eq(products.organizationId, fixture.organizationId), eq(products.id, fixture.productId)));
    await db.delete(organizations).where(eq(organizations.id, fixture.organizationId));
  }
  fixtures = [];
});

describe("عزل مؤسسات التحويل والجرد", () => {
  it("يرفض استخدام دفعة أو منتج تابع لمؤسسة أخرى في التحويل أو الجرد", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const createFixture = async (label: string, warehouseCount: number): Promise<OrganizationFixture> => {
      const organization = await db.insert(organizations).values({ name: `عزل ${label} ${suffix}`, slug: `tenant-${label}-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
      const organizationId = Number(organization[0].insertId);
      const product = await db.insert(products).values({ organizationId, name: `منتج ${label}`, sku: `SKU-${label}-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" });
      const productId = Number(product[0].insertId);
      const warehouseIds: number[] = [];
      for (let index = 0; index < warehouseCount; index += 1) {
        const warehouse = await db.insert(warehouses).values({ organizationId, name: `مخزن ${label}-${index}`, code: `WH-${label}-${index}-${suffix}`, status: "active" });
        warehouseIds.push(Number(warehouse[0].insertId));
      }
      const batch = await db.insert(productBatches).values({ organizationId, productId, warehouseId: warehouseIds[0], lotNumber: `LOT-${label}-${suffix}`, receivedQuantity: "10", currentQuantity: "10", reservedQuantity: "0", cost: "1", status: "active" });
      return { organizationId, productId, warehouseIds, batchId: Number(batch[0].insertId) };
    };
    const first = await createFixture("one", 2);
    const second = await createFixture("two", 1);
    fixtures = [first, second];

    await expect(createStockTransfer(first.organizationId, 1, { sourceWarehouseId: first.warehouseIds[0], destinationWarehouseId: first.warehouseIds[1], lines: [{ productId: second.productId, batchId: second.batchId, quantity: 1 }] })).rejects.toThrow("إحدى دفعات التحويل غير صالحة");

    const count = await createInventoryCount(first.organizationId, 1, { warehouseId: first.warehouseIds[0] });
    first.countId = count.id;
    await startInventoryCount(first.organizationId, 1, count.id);
    await expect(submitInventoryCount(first.organizationId, 1, count.id, [{ productId: second.productId, batchId: second.batchId, actualQuantity: 1 }])).rejects.toThrow("إحدى دفعات الجرد غير متاحة");

    const crossTenantTransfers = await db.select().from(stockTransfers).where(eq(stockTransfers.organizationId, first.organizationId));
    const crossTenantCountItems = await db.select().from(inventoryCountItems).where(and(eq(inventoryCountItems.organizationId, first.organizationId), eq(inventoryCountItems.countId, count.id)));
    expect(crossTenantTransfers).toHaveLength(0);
    expect(crossTenantCountItems).toHaveLength(0);
  });
});
