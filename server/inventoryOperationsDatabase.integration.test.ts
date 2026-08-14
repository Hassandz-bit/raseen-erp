import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auditLogs, inventoryBalances, inventoryCountItems, inventoryCounts, organizations, productBatches, products, stockMovements, stockTransferItems, stockTransfers, warehouses } from "../drizzle/schema";
import { approveInventoryCount, approveStockTransfer, createInventoryCount, createStockTransfer, dispatchStockTransfer, getDb, receiveStockTransfer, startInventoryCount, submitInventoryCount } from "./db";

type Fixture = { organizationId: number; productId: number; sourceWarehouseId: number; destinationWarehouseId: number; sourceBatchId: number; transferId?: number; countId?: number };
let fixture: Fixture | null = null;

afterEach(async () => {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;
  const { organizationId, productId, sourceWarehouseId, destinationWarehouseId, transferId, countId } = fixture;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
  await db.delete(stockMovements).where(eq(stockMovements.organizationId, organizationId));
  await db.delete(inventoryBalances).where(eq(inventoryBalances.organizationId, organizationId));
  if (countId) await db.delete(inventoryCountItems).where(and(eq(inventoryCountItems.organizationId, organizationId), eq(inventoryCountItems.countId, countId)));
  if (countId) await db.delete(inventoryCounts).where(and(eq(inventoryCounts.organizationId, organizationId), eq(inventoryCounts.id, countId)));
  if (transferId) await db.delete(stockTransferItems).where(and(eq(stockTransferItems.organizationId, organizationId), eq(stockTransferItems.transferId, transferId)));
  if (transferId) await db.delete(stockTransfers).where(and(eq(stockTransfers.organizationId, organizationId), eq(stockTransfers.id, transferId)));
  await db.delete(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.productId, productId)));
  await db.delete(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.id, sourceWarehouseId)));
  await db.delete(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.id, destinationWarehouseId)));
  await db.delete(products).where(and(eq(products.organizationId, organizationId), eq(products.id, productId)));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  fixture = null;
});

describe("تكامل التحويل والجرد", () => {
  it("ينقل الدفعة بين المخازن ثم يسوي فرق الجرد عند الاعتماد", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const organization = await db.insert(organizations).values({ name: `اختبار عمليات ${suffix}`, slug: `inventory-ops-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const organizationId = Number(organization[0].insertId);
    const product = await db.insert(products).values({ organizationId, name: "منتج تحويل", sku: `SKU-TRF-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" });
    const productId = Number(product[0].insertId);
    const source = await db.insert(warehouses).values({ organizationId, name: "مخزن المصدر", code: `SRC-${suffix}`, status: "active" });
    const sourceWarehouseId = Number(source[0].insertId);
    const destination = await db.insert(warehouses).values({ organizationId, name: "مخزن الوجهة", code: `DST-${suffix}`, status: "active" });
    const destinationWarehouseId = Number(destination[0].insertId);
    const batch = await db.insert(productBatches).values({ organizationId, productId, warehouseId: sourceWarehouseId, lotNumber: `LOT-TRF-${suffix}`, receivedQuantity: "10", currentQuantity: "10", reservedQuantity: "0", cost: "5", status: "active" });
    const sourceBatchId = Number(batch[0].insertId);
    fixture = { organizationId, productId, sourceWarehouseId, destinationWarehouseId, sourceBatchId };

    const transfer = await createStockTransfer(organizationId, 1, { sourceWarehouseId, destinationWarehouseId, lines: [{ productId, batchId: sourceBatchId, quantity: 5 }] });
    fixture.transferId = transfer.id;
    await approveStockTransfer(organizationId, 1, transfer.id);
    await dispatchStockTransfer(organizationId, 1, transfer.id);
    await receiveStockTransfer(organizationId, 1, transfer.id);

    const [sourceAfterTransfer] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, sourceBatchId))).limit(1);
    const [destinationBatch] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, destinationWarehouseId), eq(productBatches.productId, productId))).limit(1);
    expect(sourceAfterTransfer?.currentQuantity).toBe("5.000");
    expect(destinationBatch?.currentQuantity).toBe("5.000");

    const count = await createInventoryCount(organizationId, 1, { warehouseId: destinationWarehouseId, scope: "partial", movementMode: "reconcile" });
    fixture.countId = count.id;
    await startInventoryCount(organizationId, 1, count.id);
    await submitInventoryCount(organizationId, 1, count.id, [{ productId, batchId: destinationBatch!.id, actualQuantity: 3 }]);
    await approveInventoryCount(organizationId, 1, count.id);

    const [destinationAfterCount] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, destinationBatch!.id))).limit(1);
    const [countAfterApproval] = await db.select().from(inventoryCounts).where(and(eq(inventoryCounts.organizationId, organizationId), eq(inventoryCounts.id, count.id))).limit(1);
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.organizationId, organizationId));
    expect(destinationAfterCount?.currentQuantity).toBe("3.000");
    expect(countAfterApproval?.status).toBe("approved");
    expect(movements.map(movement => movement.movementType)).toEqual(expect.arrayContaining(["transfer_out", "transfer_in", "count_adjustment"]));
  });
});
