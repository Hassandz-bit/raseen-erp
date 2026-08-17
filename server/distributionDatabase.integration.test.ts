import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { auditLogs, distributionSettings, distributionTerritories, fleetVehicleDocuments, fleetVehicles, inventoryBalances, organizations, productBatches, products, stockMovements, vehicleLoadItems, vehicleLoadOrders, warehouses } from "../drizzle/schema";
import { createDistributionTerritory, createFleetVehicle, createVehicleLoadOrder, transitionVehicleLoadOrder } from "./distribution";
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
    await db.delete(distributionTerritories).where(eq(distributionTerritories.organizationId, organizationId));
    await db.delete(fleetVehicleDocuments).where(eq(fleetVehicleDocuments.organizationId, organizationId));
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
  it("يحفظ نقطة GPS لنطاق خدمة ضمن المؤسسة ويرفض الإحداثيات غير المكتملة", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const created = await db.insert(organizations).values({ name: `نطاق GPS ${suffix}`, slug: `territory-gps-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const organizationId = Number(created[0].insertId); fixture = { organizationIds: [organizationId] };
    const territory = await createDistributionTerritory(organizationId, 1, { code: `GPS-${suffix}`, name: "نطاق خدمة مركزي", latitude: 36.752887, longitude: 3.042048 });
    const [saved] = await db.select().from(distributionTerritories).where(and(eq(distributionTerritories.organizationId, organizationId), eq(distributionTerritories.id, territory.id))).limit(1);
    expect(saved).toMatchObject({ latitude: "36.7528870", longitude: "3.0420480" });
    await expect(createDistributionTerritory(organizationId, 1, { code: `BAD-${suffix}`, name: "نطاق ناقص", latitude: 36.7 })).rejects.toThrow("خط العرض وخط الطول");
  });

  it("ينشئ وثيقتي التأمين والمراقبة التقنية مع تواريخ صحيحة داخل المؤسسة", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const created = await db.insert(organizations).values({ name: `وثائق مركبة ${suffix}`, slug: `vehicle-docs-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const organizationId = Number(created[0].insertId); fixture = { organizationIds: [organizationId] };
    const vehicle = await createFleetVehicle(organizationId, 1, { code: `DOC-${suffix}`, registrationNumber: `REG-DOC-${suffix}`, type: "van", ownershipType: "owned", maximumPayloadWeight: 10, maximumVolume: 4, insuranceStartAt: new Date("2026-01-01T00:00:00Z"), insuranceEndAt: new Date("2026-12-31T23:59:59Z"), technicalInspectionStartAt: new Date("2026-02-01T00:00:00Z"), technicalInspectionEndAt: new Date("2026-11-30T23:59:59Z") });
    const documents = await db.select().from(fleetVehicleDocuments).where(and(eq(fleetVehicleDocuments.organizationId, organizationId), eq(fleetVehicleDocuments.vehicleId, vehicle.id)));
    expect(documents.map(document => document.documentType)).toEqual(expect.arrayContaining(["insurance", "technical_inspection"]));
    expect(documents.find(document => document.documentType === "insurance")).toMatchObject({ issuedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2026-12-31T23:59:59Z") });
    await expect(createFleetVehicle(organizationId, 1, { code: `BAD-DOC-${suffix}`, registrationNumber: `REG-BAD-${suffix}`, type: "van", ownershipType: "owned", maximumPayloadWeight: 10, maximumVolume: 4, insuranceStartAt: new Date("2026-12-31T00:00:00Z"), insuranceEndAt: new Date("2026-01-01T00:00:00Z") })).rejects.toThrow("انتهاء التأمين");
  });

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
