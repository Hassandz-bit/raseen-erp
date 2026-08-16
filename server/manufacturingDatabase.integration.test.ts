import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auditLogs, inventoryBalances, organizations, productBatches, products, stockMovements, warehouses } from "../drizzle/schema";
import { manufacturingBomItems, manufacturingBoms, productionMaterialReservations, productionOrders, productionOutputs, productionStages } from "../drizzle/manufacturingSchema";
import { getDb } from "./db";
import { closeProductionOrder, createProductionOrder, getProductionTraceability, issueMaterialsForProduction, recordProductionOutput, reserveProductionMaterials, transitionProductionOrderStatus } from "./manufacturing";

let organizationId: number | null = null;

afterEach(async () => {
  if (!organizationId) return;
  const db = await getDb();
  if (!db) return;
  const id = organizationId;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, id));
  await db.delete(stockMovements).where(eq(stockMovements.organizationId, id));
  await db.delete(inventoryBalances).where(eq(inventoryBalances.organizationId, id));
  await db.delete(productionOutputs).where(eq(productionOutputs.organizationId, id));
  await db.delete(productionMaterialReservations).where(eq(productionMaterialReservations.organizationId, id));
  await db.delete(productionStages).where(eq(productionStages.organizationId, id));
  await db.delete(productionOrders).where(eq(productionOrders.organizationId, id));
  await db.delete(manufacturingBomItems).where(eq(manufacturingBomItems.organizationId, id));
  await db.delete(manufacturingBoms).where(eq(manufacturingBoms.organizationId, id));
  await db.delete(productBatches).where(eq(productBatches.organizationId, id));
  await db.delete(warehouses).where(eq(warehouses.organizationId, id));
  await db.delete(products).where(eq(products.organizationId, id));
  await db.delete(organizations).where(eq(organizations.id, id));
  organizationId = null;
});

describe("تكامل دورة التصنيع", () => {
  it("يحجز ويسحب المواد وفق FEFO ثم ينشئ دفعة نهائية قابلة للتتبع ويقفل الأمر", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const organization = await db.insert(organizations).values({ name: `اختبار تصنيع ${suffix}`, slug: `manufacturing-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(organization[0].insertId);
    const rawProduct = await db.insert(products).values({ organizationId, name: "مادة خام", sku: `RAW-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" });
    const finishedProduct = await db.insert(products).values({ organizationId, name: "منتج نهائي", sku: `FG-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", status: "active" });
    const rawProductId = Number(rawProduct[0].insertId);
    const finishedProductId = Number(finishedProduct[0].insertId);
    const rawWarehouse = await db.insert(warehouses).values({ organizationId, name: "مخزن خام", code: `RAW-WH-${suffix}`, status: "active" });
    const finishedWarehouse = await db.insert(warehouses).values({ organizationId, name: "مخزن تام", code: `FG-WH-${suffix}`, status: "active" });
    const rawWarehouseId = Number(rawWarehouse[0].insertId);
    const finishedWarehouseId = Number(finishedWarehouse[0].insertId);
    const earlier = await db.insert(productBatches).values({ organizationId, productId: rawProductId, warehouseId: rawWarehouseId, lotNumber: `RAW-EARLY-${suffix}`, receivedQuantity: "4", currentQuantity: "4", reservedQuantity: "0", cost: "2", expiryDate: new Date(Date.now() + 86_400_000), status: "active" });
    const later = await db.insert(productBatches).values({ organizationId, productId: rawProductId, warehouseId: rawWarehouseId, lotNumber: `RAW-LATE-${suffix}`, receivedQuantity: "2", currentQuantity: "2", reservedQuantity: "0", cost: "3", expiryDate: new Date(Date.now() + 172_800_000), status: "active" });
    const earlierBatchId = Number(earlier[0].insertId);
    const laterBatchId = Number(later[0].insertId);
    const bom = await db.insert(manufacturingBoms).values({ organizationId, productId: finishedProductId, code: `BOM-${suffix}`, version: "1", status: "active", outputQuantity: "6", outputUnit: "قطعة", createdByUserId: 1 });
    const bomId = Number(bom[0].insertId);
    await db.insert(manufacturingBomItems).values({ organizationId, bomId, componentProductId: rawProductId, quantity: "6", unit: "قطعة", baseQuantity: "6", wasteAllowance: "0", stageCode: "mixing", required: "yes" });

    const order = await createProductionOrder(organizationId, 1, { bomId, plannedQuantity: 6, plannedUnit: "قطعة", baseQuantity: 6, rawMaterialWarehouseId: rawWarehouseId, finishedGoodsWarehouseId: finishedWarehouseId });
    await transitionProductionOrderStatus(organizationId, 1, order.id, "planned");
    await transitionProductionOrderStatus(organizationId, 1, order.id, "approved");
    const reservation = await reserveProductionMaterials(organizationId, 1, order.id);
    const stages = await db.select().from(productionStages).where(and(eq(productionStages.organizationId, organizationId), eq(productionStages.productionOrderId, order.id)));
    expect(reservation.reservations.map(item => item.batchId)).toEqual([earlierBatchId, laterBatchId]);
    expect(stages.map(stage => stage.code)).toEqual(["mixing"]);
    await issueMaterialsForProduction(organizationId, 1, order.id);
    const output = await recordProductionOutput(organizationId, 1, order.id, { lotNumber: `FG-${suffix}`, goodQuantity: 6 });
    const traceability = await getProductionTraceability(organizationId, order.id);
    const close = await closeProductionOrder(organizationId, 1, order.id);

    const [earlierAfter] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, earlierBatchId))).limit(1);
    const [laterAfter] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, laterBatchId))).limit(1);
    const [finishedBatch] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, output.batchId))).limit(1);
    expect(earlierAfter?.currentQuantity).toBe("0.000");
    expect(laterAfter?.currentQuantity).toBe("0.000");
    expect(finishedBatch?.status).toBe("active");
    expect(traceability.rawMaterials).toHaveLength(2);
    expect(traceability.outputs).toHaveLength(1);
    expect(close.status).toBe("closed");
  });
});
