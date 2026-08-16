import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { auditLogs, distributionSettings, fleetVehicles, inventoryBalances, organizations, productBatches, products, stockMovements, vehicleLoadItems, vehicleLoadOrders, warehouses } from "../drizzle/schema";
import { createFleetVehicle, createVehicleLoadOrder, transitionVehicleLoadOrder } from "./distribution";
import { getDb } from "./db";

let fixture: { organizationIds: number[]; productId?: number; sourceWarehouseId?: number; vehicleWarehouseId?: number } | null = null;

afterEach(async () => {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;
  for (const organizationId of fixture.organizationIds) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
    await db.delete(stockMovements).where(eq(stockMovements.organizationId, organizationId));
    await db.delete(inventoryBalances).where(eq(inventoryBalances.organizationId, organizationId));
    await db.delete(vehicleLoadItems).where(eq(vehicleLoadItems.organizationId, organizationId));
    await db.delete(vehicleLoadOrders).where(eq(vehicleLoadOrders.organizationId, organizationId));
    await db.delete(fleetVehicles).where(eq(fleetVehicles.organizationId, organizationId));
    await db.delete(distributionSettings).where(eq(distributionSettings.organizationId, organizationId));
    await db.delete(productBatches).where(eq(productBatches.organizationId, organizationId));
    await db.delete(warehouses).where(eq(warehouses.organizationId, organizationId));
    await db.delete(products).where(eq(products.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  fixture = null;
});

describe("تكامل تحميل المركبة", () => {
  it("يعزل المؤسسة وينقل دفعة نشطة إلى مخزن المركبة مرة واحدة مع حركات مدققة", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const created = await db.insert(organizations).values({ name: `اختبار توزيع ${suffix}`, slug: `distribution-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const second = await db.insert(organizations).values({ name: `اختبار عزل ${suffix}`, slug: `distribution-isolation-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const organizationId = Number(created[0].insertId);
    const secondOrganizationId = Number(second[0].insertId);
    fixture = { organizationIds: [organizationId, secondOrganizationId] };
    const product = await db.insert(products).values({ organizationId, name: "منتج تحميل", sku: `DIST-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", grossWeight: "2", volume: "0.5", unitsPerCarton: "5", status: "active" });
    const productId = Number(product[0].insertId);
    const warehouse = await db.insert(warehouses).values({ organizationId, code: `SRC-DIST-${suffix}`, name: "مخزن التحميل", status: "active" });
    const sourceWarehouseId = Number(warehouse[0].insertId);
    const batch = await db.insert(productBatches).values({ organizationId, productId, warehouseId: sourceWarehouseId, lotNumber: `LOT-DIST-${suffix}`, receivedQuantity: "10", currentQuantity: "10", reservedQuantity: "0", cost: "3", status: "active" });
    const sourceBatchId = Number(batch[0].insertId);
    const vehicle = await createFleetVehicle(organizationId, 1, { code: `V-${suffix}`, registrationNumber: `REG-${suffix}`, type: "van", ownershipType: "owned", maximumPayloadWeight: 15, maximumVolume: 5 });
    fixture.productId = productId;
    fixture.sourceWarehouseId = sourceWarehouseId;
    fixture.vehicleWarehouseId = vehicle.mobileWarehouseId;

    await expect(createVehicleLoadOrder(secondOrganizationId, 1, { sourceWarehouseId, vehicleId: vehicle.id, lines: [{ productId, batchId: sourceBatchId, quantity: 2, unit: "قطعة" }] })).rejects.toThrow("المركبة غير متاح");
    const load = await createVehicleLoadOrder(organizationId, 1, { sourceWarehouseId, vehicleId: vehicle.id, lines: [{ productId, batchId: sourceBatchId, quantity: 6, unit: "قطعة" }] });
    expect(load.capacity.overloaded).toBe(false);
    await transitionVehicleLoadOrder(organizationId, 1, load.id, "prepared");
    await transitionVehicleLoadOrder(organizationId, 1, load.id, "approved");
    await transitionVehicleLoadOrder(organizationId, 1, load.id, "loading");
    await transitionVehicleLoadOrder(organizationId, 1, load.id, "loaded");
    await transitionVehicleLoadOrder(organizationId, 1, load.id, "dispatched");
    await expect(transitionVehicleLoadOrder(organizationId, 1, load.id, "dispatched")).rejects.toThrow("لا يسمح انتقال حالة أمر التحميل");

    const [sourceAfter] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.id, sourceBatchId))).limit(1);
    const [vehicleBatch] = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, vehicle.mobileWarehouseId), eq(productBatches.productId, productId))).limit(1);
    const movements = await db.select().from(stockMovements).where(eq(stockMovements.organizationId, organizationId));
    expect(sourceAfter?.currentQuantity).toBe("4.000");
    expect(vehicleBatch?.currentQuantity).toBe("6.000");
    expect(movements.map(row => row.movementType)).toEqual(expect.arrayContaining(["vehicle_load_out", "vehicle_load_in"]));
  });
});
