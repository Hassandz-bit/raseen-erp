import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  auditLogs, branches, businessParties, distributionCollections, distributionDeliveries, distributionDeliveryItems, distributionGeofenceEvents, distributionIdempotencyKeys, distributionReturns, distributionRouteClosings, distributionRouteExpenses, distributionRouteStops, distributionRoutes, distributionSettings, distributionTerritories, employees, fleetFuelLogs, fleetGpsRecords, fleetMaintenanceRecords, fleetVehicleDocuments, fleetVehicles, inventoryBalances, organizationSettings, productBatches, products, salesInvoices, stockMovements, vehicleLoadItems, vehicleLoadOrders, warehouses,
} from "../drizzle/schema";
import { getDb } from "./db";
import { calculateLoadCapacity, canTransitionDistributionRoute, canTransitionRouteClosing, canTransitionVehicleLoad } from "./distributionPolicy";

const number = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
const base = (value: unknown) => Number(value ?? 0);

async function assertOrganizationRecord<T extends { organizationId: number }>(row: T | undefined, entity: string) {
  if (!row) throw new Error(`${entity} غير متاح ضمن المؤسسة الحالية.`);
  return row;
}

async function assertVehicle(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, organizationId: number, vehicleId: number) {
  const [vehicle] = await db.select().from(fleetVehicles).where(and(eq(fleetVehicles.organizationId, organizationId), eq(fleetVehicles.id, vehicleId))).limit(1);
  return assertOrganizationRecord(vehicle, "المركبة");
}

export async function getDistributionSettings(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(distributionSettings).values({ organizationId }).onDuplicateKeyUpdate({ set: { organizationId } });
  const [settings] = await db.select().from(distributionSettings).where(eq(distributionSettings.organizationId, organizationId)).limit(1);
  return settings!;
}

export async function saveDistributionSettings(organizationId: number, input: { overloadPolicy?: "warning" | "hard_block" | "manager_override"; visitRadiusMeters?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(distributionSettings).values({ organizationId, overloadPolicy: input.overloadPolicy ?? "warning", visitRadiusMeters: input.visitRadiusMeters ?? 100 }).onDuplicateKeyUpdate({ set: input });
  return getDistributionSettings(organizationId);
}

export async function listFleetVehicles(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(fleetVehicles).where(eq(fleetVehicles.organizationId, organizationId)).orderBy(desc(fleetVehicles.updatedAt), desc(fleetVehicles.id)).limit(200);
}

export async function createFleetVehicle(organizationId: number, actorUserId: number, input: { code: string; registrationNumber: string; type: string; brand?: string; model?: string; modelYear?: number; branchId?: number; ownerPartyId?: number; ownershipType: "owned" | "leased" | "external"; driverEmployeeId?: number; representativeEmployeeId?: number; maximumPayloadWeight: number; maximumVolume: number; palletCapacity?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    if (input.branchId) await assertOrganizationRecord((await tx.select().from(branches).where(and(eq(branches.id, input.branchId), eq(branches.organizationId, organizationId))).limit(1))[0], "الفرع");
    if (input.ownerPartyId) await assertOrganizationRecord((await tx.select().from(businessParties).where(and(eq(businessParties.id, input.ownerPartyId), eq(businessParties.organizationId, organizationId))).limit(1))[0], "مالك المركبة");
    if (input.ownershipType === "external" && !input.ownerPartyId) throw new Error("تتطلب المركبة الخارجية طرف أعمال مالكاً ضمن المؤسسة.");
    const warehouseResult = await tx.insert(warehouses).values({ organizationId, branchId: input.branchId, code: `VAN-${input.code.trim().toUpperCase()}`, name: `Vehicle ${input.code.trim()}`, isMobile: "yes", status: "active" });
    const mobileWarehouseId = Number(warehouseResult[0].insertId);
    const vehicleResult = await tx.insert(fleetVehicles).values({ organizationId, branchId: input.branchId, code: input.code.trim().toUpperCase(), registrationNumber: input.registrationNumber.trim().toUpperCase(), type: input.type.trim(), brand: input.brand?.trim(), model: input.model?.trim(), modelYear: input.modelYear, ownerPartyId: input.ownerPartyId, ownershipType: input.ownershipType, driverEmployeeId: input.driverEmployeeId, representativeEmployeeId: input.representativeEmployeeId, mobileWarehouseId, maximumPayloadWeight: String(input.maximumPayloadWeight), maximumVolume: String(input.maximumVolume), palletCapacity: input.palletCapacity ?? 0, status: "active" });
    const id = Number(vehicleResult[0].insertId);
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "fleet_vehicle.created", entityType: "fleet_vehicle", entityId: String(id), metadata: { mobileWarehouseId } });
    return { id, mobileWarehouseId };
  });
}

export async function createDistributionTerritory(organizationId: number, actorUserId: number, input: { code: string; name: string; branchId?: number; representativeEmployeeId?: number; defaultVehicleId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.branchId) await assertOrganizationRecord((await db.select().from(branches).where(and(eq(branches.id, input.branchId), eq(branches.organizationId, organizationId))).limit(1))[0], "الفرع");
  if (input.defaultVehicleId) await assertVehicle(db, organizationId, input.defaultVehicleId);
  const result = await db.insert(distributionTerritories).values({ organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), branchId: input.branchId, representativeEmployeeId: input.representativeEmployeeId, defaultVehicleId: input.defaultVehicleId });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_territory.created", entityType: "distribution_territory", entityId: String(id), metadata: { branchId: input.branchId ?? null } });
  return { id };
}

export async function listDistributionTerritories(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(distributionTerritories).where(eq(distributionTerritories.organizationId, organizationId)).orderBy(distributionTerritories.name).limit(200);
}

export async function createVehicleDocument(organizationId: number, actorUserId: number, input: { vehicleId: number; documentType: "insurance" | "technical_inspection" | "registration" | "other"; referenceNumber?: string; expiresAt?: Date; attachmentUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await assertVehicle(db, organizationId, input.vehicleId);
  const status = input.expiresAt && input.expiresAt < new Date() ? "expired" : "valid" as const;
  const result = await db.insert(fleetVehicleDocuments).values({ organizationId, vehicleId: input.vehicleId, documentType: input.documentType, referenceNumber: input.referenceNumber?.trim(), expiresAt: input.expiresAt, attachmentUrl: input.attachmentUrl, status });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "fleet_vehicle.document_created", entityType: "fleet_vehicle_document", entityId: String(id), metadata: { vehicleId: input.vehicleId, documentType: input.documentType } });
  return { id };
}

export async function logFuel(organizationId: number, actorUserId: number, input: { vehicleId: number; routeId?: number; driverEmployeeId?: number; odometer: number; fuelQuantity: number; fuelType: string; unitPrice: number; currencyCode: string; vendor?: string; attachmentUrl?: string; occurredAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await assertVehicle(db, organizationId, input.vehicleId);
  const totalCost = input.fuelQuantity * input.unitPrice;
  const result = await db.insert(fleetFuelLogs).values({ organizationId, vehicleId: input.vehicleId, routeId: input.routeId, driverEmployeeId: input.driverEmployeeId, odometer: String(input.odometer), fuelQuantity: String(input.fuelQuantity), fuelType: input.fuelType.trim(), unitPrice: String(input.unitPrice), totalCost: String(totalCost), currencyCode: input.currencyCode.toUpperCase(), vendor: input.vendor?.trim(), attachmentUrl: input.attachmentUrl, occurredAt: input.occurredAt ?? new Date(), createdByUserId: actorUserId });
  await db.update(fleetVehicles).set({ odometer: String(input.odometer) }).where(and(eq(fleetVehicles.id, input.vehicleId), eq(fleetVehicles.organizationId, organizationId)));
  return { id: Number(result[0].insertId), totalCost };
}

export async function createMaintenanceRecord(organizationId: number, actorUserId: number, input: { vehicleId: number; maintenanceType: "preventive" | "corrective" | "oil" | "tires" | "technical_inspection" | "other"; occurredAt: Date; currencyCode: string; status?: "planned" | "in_progress" | "completed" | "cancelled"; odometer?: number; cost?: number; supplierPartyId?: number; description?: string; nextDueAt?: Date; nextDueOdometer?: number; attachmentUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await assertVehicle(db, organizationId, input.vehicleId);
  const result = await db.insert(fleetMaintenanceRecords).values({ organizationId, vehicleId: input.vehicleId, maintenanceType: input.maintenanceType, status: input.status ?? "planned", occurredAt: input.occurredAt, odometer: input.odometer === undefined ? undefined : String(input.odometer), cost: String(input.cost ?? 0), currencyCode: input.currencyCode.toUpperCase(), supplierPartyId: input.supplierPartyId, description: input.description?.trim(), nextDueAt: input.nextDueAt, nextDueOdometer: input.nextDueOdometer === undefined ? undefined : String(input.nextDueOdometer), attachmentUrl: input.attachmentUrl, createdByUserId: actorUserId });
  return { id: Number(result[0].insertId) };
}

export async function createDistributionRoute(organizationId: number, actorUserId: number, input: { routeNumber?: string; routeDate: Date; branchId?: number; territoryId?: number; vehicleId?: number; driverEmployeeId?: number; representativeEmployeeId?: number; plannedStartAt?: Date; plannedEndAt?: Date; stops: Array<{ customerId: number; salesInvoiceId?: number; salesOrderReference?: string; plannedAt?: Date; notes?: string }> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    if (input.branchId) await assertOrganizationRecord((await tx.select().from(branches).where(and(eq(branches.id, input.branchId), eq(branches.organizationId, organizationId))).limit(1))[0], "الفرع");
    if (input.territoryId) await assertOrganizationRecord((await tx.select().from(distributionTerritories).where(and(eq(distributionTerritories.id, input.territoryId), eq(distributionTerritories.organizationId, organizationId))).limit(1))[0], "المنطقة");
    if (input.vehicleId) await assertOrganizationRecord((await tx.select().from(fleetVehicles).where(and(eq(fleetVehicles.id, input.vehicleId), eq(fleetVehicles.organizationId, organizationId), eq(fleetVehicles.status, "active"))).limit(1))[0], "المركبة");
    for (const stop of input.stops) await assertOrganizationRecord((await tx.select().from(businessParties).where(and(eq(businessParties.id, stop.customerId), eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).limit(1))[0], "العميل");
    const result = await tx.insert(distributionRoutes).values({ organizationId, routeNumber: input.routeNumber?.trim() || number("RTE"), routeDate: input.routeDate, branchId: input.branchId, territoryId: input.territoryId, vehicleId: input.vehicleId, driverEmployeeId: input.driverEmployeeId, representativeEmployeeId: input.representativeEmployeeId, plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, status: "planned", createdByUserId: actorUserId });
    const id = Number(result[0].insertId);
    if (input.stops.length) await tx.insert(distributionRouteStops).values(input.stops.map((stop, index) => ({ organizationId, routeId: id, customerId: stop.customerId, salesInvoiceId: stop.salesInvoiceId, salesOrderReference: stop.salesOrderReference?.trim(), sequence: index + 1, plannedAt: stop.plannedAt, notes: stop.notes?.trim() })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_route.created", entityType: "distribution_route", entityId: String(id), metadata: { stops: input.stops.length, vehicleId: input.vehicleId ?? null } });
    return { id, status: "planned" as const };
  });
}

export async function listDistributionRoutes(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(distributionRoutes).where(eq(distributionRoutes.organizationId, organizationId)).orderBy(desc(distributionRoutes.routeDate), desc(distributionRoutes.id)).limit(200);
}

export async function transitionDistributionRoute(organizationId: number, actorUserId: number, routeId: number, status: "prepared" | "loaded" | "started" | "in_progress" | "returning" | "closing" | "closed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [route] = await db.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1);
  await assertOrganizationRecord(route, "الجولة");
  if (!canTransitionDistributionRoute(route.status, status)) throw new Error("لا يسمح انتقال حالة الجولة من وضعها الحالي.");
  const timestamps = status === "started" ? { actualStartAt: new Date() } : status === "closed" ? { actualEndAt: new Date() } : {};
  await db.update(distributionRoutes).set({ status, ...timestamps }).where(and(eq(distributionRoutes.id, routeId), eq(distributionRoutes.organizationId, organizationId), eq(distributionRoutes.status, route.status)));
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: `distribution_route.${status}`, entityType: "distribution_route", entityId: String(routeId), metadata: null });
  return { id: routeId, status };
}

export async function createVehicleLoadOrder(organizationId: number, actorUserId: number, input: { loadNumber?: string; sourceWarehouseId: number; vehicleId: number; routeId?: number; lines: Array<{ productId: number; batchId: number; quantity: number; unit: string }>; overrideReason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const vehicle = await assertOrganizationRecord((await tx.select().from(fleetVehicles).where(and(eq(fleetVehicles.id, input.vehicleId), eq(fleetVehicles.organizationId, organizationId), eq(fleetVehicles.status, "active"))).limit(1))[0], "المركبة");
    await assertOrganizationRecord((await tx.select().from(warehouses).where(and(eq(warehouses.id, input.sourceWarehouseId), eq(warehouses.organizationId, organizationId), eq(warehouses.status, "active"))).limit(1))[0], "مخزن المصدر");
    if (input.sourceWarehouseId === vehicle.mobileWarehouseId) throw new Error("لا يمكن تحميل المركبة من مخزنها المتنقل نفسه.");
    const materialized = [] as Array<{ productId: number; batchId: number; quantity: number; unit: string; unitWeight: number; unitVolume: number; packages: number }>;
    for (const line of input.lines) {
      const [batch] = await tx.select().from(productBatches).where(and(eq(productBatches.id, line.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.productId, line.productId), eq(productBatches.warehouseId, input.sourceWarehouseId), eq(productBatches.status, "active"), sql`(${productBatches.expiryDate} IS NULL OR ${productBatches.expiryDate} > now())`)).limit(1);
      if (!batch || base(batch.currentQuantity) - base(batch.reservedQuantity) < line.quantity) throw new Error("دفعة التحميل غير صالحة أو لا تحتوي كمية متاحة وفق FEFO.");
      const [product] = await tx.select().from(products).where(and(eq(products.id, line.productId), eq(products.organizationId, organizationId))).limit(1);
      await assertOrganizationRecord(product, "المنتج");
      materialized.push({ productId: line.productId, batchId: line.batchId, quantity: line.quantity, unit: line.unit, unitWeight: base(product.grossWeight ?? product.netWeight), unitVolume: base(product.volume) || base(product.length) * base(product.width) * base(product.height), packages: base(product.unitsPerCarton) > 0 ? line.quantity / base(product.unitsPerCarton) : 0 });
    }
    const capacity = calculateLoadCapacity(materialized, { maximumPayloadWeight: base(vehicle.maximumPayloadWeight), maximumVolume: base(vehicle.maximumVolume) });
    const settings = await getDistributionSettings(organizationId);
    const requiresOverride = capacity.overloaded && settings.overloadPolicy === "manager_override";
    if (capacity.overloaded && settings.overloadPolicy === "hard_block") throw new Error("تجاوزت الحمولة الحد المسموح وتطبق المؤسسة المنع الصارم.");
    if (requiresOverride && !input.overrideReason?.trim()) throw new Error("يتطلب تجاوز الحمولة سبباً للاعتماد الإداري.");
    const result = await tx.insert(vehicleLoadOrders).values({ organizationId, loadNumber: input.loadNumber?.trim() || number("LOAD"), sourceWarehouseId: input.sourceWarehouseId, vehicleId: input.vehicleId, routeId: input.routeId, driverEmployeeId: vehicle.driverEmployeeId, representativeEmployeeId: vehicle.representativeEmployeeId, status: "draft", totalWeight: String(capacity.totalWeight), totalVolume: String(capacity.totalVolume), totalPackages: String(capacity.totalPackages), payloadUtilization: String(capacity.payloadUtilization), volumeUtilization: String(capacity.volumeUtilization), overloadOverrideReason: input.overrideReason?.trim(), overloadApprovedByUserId: requiresOverride ? actorUserId : undefined, overloadApprovedAt: requiresOverride ? new Date() : undefined, createdByUserId: actorUserId });
    const id = Number(result[0].insertId);
    await tx.insert(vehicleLoadItems).values(materialized.map(line => ({ organizationId, loadOrderId: id, productId: line.productId, sourceBatchId: line.batchId, quantity: String(line.quantity), unit: line.unit, unitWeight: String(line.unitWeight), unitVolume: String(line.unitVolume), packages: String(line.packages) })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "vehicle_load.created", entityType: "vehicle_load_order", entityId: String(id), metadata: { capacity, overloadPolicy: settings.overloadPolicy } });
    return { id, capacity, status: "draft" as const };
  });
}

export async function transitionVehicleLoadOrder(organizationId: number, actorUserId: number, loadOrderId: number, status: "prepared" | "approved" | "loading" | "loaded" | "dispatched" | "closed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const load = await assertOrganizationRecord((await tx.select().from(vehicleLoadOrders).where(and(eq(vehicleLoadOrders.id, loadOrderId), eq(vehicleLoadOrders.organizationId, organizationId))).limit(1))[0], "أمر التحميل");
    if (!canTransitionVehicleLoad(load.status, status)) throw new Error("لا يسمح انتقال حالة أمر التحميل من وضعه الحالي.");
    if (status === "dispatched") {
      const vehicle = await assertOrganizationRecord((await tx.select().from(fleetVehicles).where(and(eq(fleetVehicles.id, load.vehicleId), eq(fleetVehicles.organizationId, organizationId))).limit(1))[0], "المركبة");
      const items = await tx.select().from(vehicleLoadItems).where(and(eq(vehicleLoadItems.organizationId, organizationId), eq(vehicleLoadItems.loadOrderId, loadOrderId)));
      for (const item of items) {
        if (!item.sourceBatchId) throw new Error("يتطلب كل سطر تحميل دفعة مصدر.");
        const sourceBatch = await assertOrganizationRecord((await tx.select().from(productBatches).where(and(eq(productBatches.id, item.sourceBatchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, load.sourceWarehouseId), eq(productBatches.status, "active"), sql`(${productBatches.expiryDate} IS NULL OR ${productBatches.expiryDate} > now())`)).limit(1))[0], "دفعة المصدر");
        const quantity = base(item.quantity);
        const sourceUpdated = await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} - ${quantity}` }).where(and(eq(productBatches.id, sourceBatch.id), eq(productBatches.organizationId, organizationId), sql`${productBatches.currentQuantity} - ${productBatches.reservedQuantity} >= ${quantity}`));
        if (!Number(sourceUpdated[0]?.affectedRows ?? 0)) throw new Error("تعذر صرف كمية التحميل بأمان.");
        const destination = await tx.insert(productBatches).values({ organizationId, productId: item.productId, warehouseId: vehicle.mobileWarehouseId!, lotNumber: `${sourceBatch.lotNumber}-V${loadOrderId}`, sourcePartyId: sourceBatch.sourcePartyId, receivedQuantity: String(quantity), currentQuantity: String(quantity), reservedQuantity: "0", cost: sourceBatch.cost, manufacturingDate: sourceBatch.manufacturingDate, expiryDate: sourceBatch.expiryDate, status: "active" });
        const vehicleBatchId = Number(destination[0].insertId);
        await tx.update(vehicleLoadItems).set({ vehicleBatchId }).where(and(eq(vehicleLoadItems.id, item.id), eq(vehicleLoadItems.organizationId, organizationId)));
        await tx.insert(stockMovements).values([{ organizationId, warehouseId: load.sourceWarehouseId, productId: item.productId, batchId: sourceBatch.id, movementType: "vehicle_load_out", quantity: String(-quantity), unit: item.unit, sourceDocumentType: "vehicle_load", sourceDocumentId: loadOrderId, occurredAt: new Date(), actorUserId, auditReference: `LOAD-${loadOrderId}` }, { organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: item.productId, batchId: vehicleBatchId, movementType: "vehicle_load_in", quantity: String(quantity), unit: item.unit, sourceDocumentType: "vehicle_load", sourceDocumentId: loadOrderId, occurredAt: new Date(), actorUserId, auditReference: `LOAD-${loadOrderId}` }]);
        await tx.insert(inventoryBalances).values({ organizationId, warehouseId: load.sourceWarehouseId, productId: item.productId, quantity: String(-quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} - ${quantity}` } });
        await tx.insert(inventoryBalances).values({ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: item.productId, quantity: String(quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${quantity}` } });
      }
    }
    await tx.update(vehicleLoadOrders).set({ status, loadDate: status === "dispatched" ? new Date() : undefined, approvedByUserId: status === "approved" ? actorUserId : undefined }).where(and(eq(vehicleLoadOrders.id, loadOrderId), eq(vehicleLoadOrders.organizationId, organizationId), eq(vehicleLoadOrders.status, load.status)));
    if (status === "dispatched" && load.routeId) await tx.update(distributionRoutes).set({ loadOrderId, status: "loaded" }).where(and(eq(distributionRoutes.id, load.routeId), eq(distributionRoutes.organizationId, organizationId), eq(distributionRoutes.status, "prepared")));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: `vehicle_load.${status}`, entityType: "vehicle_load_order", entityId: String(loadOrderId), metadata: null });
    return { id: loadOrderId, status };
  });
}

export async function recordDistributionDelivery(organizationId: number, actorUserId: number, input: { routeId: number; stopId?: number; customerId: number; salesInvoiceId?: number; idempotencyKey: string; notes?: string; items: Array<{ productId: number; vehicleBatchId: number; expectedQuantity?: number; deliveredQuantity: number; rejectedQuantity?: number; returnedQuantity?: number; unit: string }> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const duplicate = await tx.select().from(distributionDeliveries).where(and(eq(distributionDeliveries.organizationId, organizationId), eq(distributionDeliveries.idempotencyKey, input.idempotencyKey))).limit(1);
    if (duplicate[0]) return { id: duplicate[0].id, status: duplicate[0].status, replayed: true as const };
    const route = await assertOrganizationRecord((await tx.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1))[0], "الجولة");
    if (!route.vehicleId || !["started", "in_progress", "returning"].includes(route.status)) throw new Error("لا يمكن تسجيل تسليم خارج جولة بدأت ومركبة مسندة.");
    const statuses = input.items.map(item => item.deliveredQuantity > 0 ? "full" : "failed");
    const status = statuses.every(item => item === "full") ? "full" : statuses.some(item => item === "full") ? "partial" : "failed" as const;
    const inserted = await tx.insert(distributionDeliveries).values({ organizationId, deliveryNumber: number("DLV"), routeId: input.routeId, stopId: input.stopId, vehicleId: route.vehicleId, customerId: input.customerId, salesInvoiceId: input.salesInvoiceId, status, deliveredAt: new Date(), notes: input.notes?.trim(), idempotencyKey: input.idempotencyKey.trim(), createdByUserId: actorUserId });
    const deliveryId = Number(inserted[0].insertId);
    for (const item of input.items) {
      const batch = await assertOrganizationRecord((await tx.select().from(productBatches).where(and(eq(productBatches.id, item.vehicleBatchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, route.vehicleId ? (await tx.select({ mobileWarehouseId: fleetVehicles.mobileWarehouseId }).from(fleetVehicles).where(and(eq(fleetVehicles.id, route.vehicleId), eq(fleetVehicles.organizationId, organizationId))).limit(1))[0]?.mobileWarehouseId! : -1), eq(productBatches.productId, item.productId), eq(productBatches.status, "active"))).limit(1))[0], "دفعة المركبة");
      if (base(batch.currentQuantity) < item.deliveredQuantity) throw new Error("كمية تسليم المركبة غير متاحة.");
      if (item.deliveredQuantity > 0) {
        await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} - ${item.deliveredQuantity}` }).where(and(eq(productBatches.id, batch.id), eq(productBatches.organizationId, organizationId), sql`${productBatches.currentQuantity} >= ${item.deliveredQuantity}`));
        await tx.insert(stockMovements).values({ organizationId, warehouseId: batch.warehouseId, productId: item.productId, batchId: batch.id, movementType: "delivery_issue", quantity: String(-item.deliveredQuantity), unit: item.unit, sourceDocumentType: "distribution_delivery", sourceDocumentId: deliveryId, occurredAt: new Date(), actorUserId, auditReference: `DLV-${deliveryId}` });
        await tx.insert(inventoryBalances).values({ organizationId, warehouseId: batch.warehouseId, productId: item.productId, quantity: String(-item.deliveredQuantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} - ${item.deliveredQuantity}` } });
      }
      await tx.insert(distributionDeliveryItems).values({ organizationId, deliveryId, productId: item.productId, vehicleBatchId: item.vehicleBatchId, expectedQuantity: String(item.expectedQuantity ?? item.deliveredQuantity), deliveredQuantity: String(item.deliveredQuantity), rejectedQuantity: String(item.rejectedQuantity ?? 0), returnedQuantity: String(item.returnedQuantity ?? 0), unit: item.unit });
    }
    if (input.stopId) await tx.update(distributionRouteStops).set({ deliveryStatus: status === "full" ? "delivered" : status === "partial" ? "partial" : "failed" }).where(and(eq(distributionRouteStops.id, input.stopId), eq(distributionRouteStops.organizationId, organizationId), eq(distributionRouteStops.routeId, input.routeId)));
    await tx.insert(distributionIdempotencyKeys).values({ organizationId, operation: "delivery", idempotencyKey: input.idempotencyKey.trim(), entityType: "distribution_delivery", entityId: deliveryId });
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_delivery.recorded", entityType: "distribution_delivery", entityId: String(deliveryId), metadata: { routeId: input.routeId, status } });
    return { id: deliveryId, status, replayed: false as const };
  });
}

export async function recordDistributionCollection(organizationId: number, actorUserId: number, input: { routeId: number; customerId: number; salesInvoiceId?: number; representativeEmployeeId?: number; driverEmployeeId?: number; collectionType: "cash_sale" | "current_invoice" | "previous_debt"; amount: number; currencyCode: string; exchangeRateUsed?: number; paymentMethod?: "cash" | "card" | "transfer" | "check" | "other"; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const duplicate = await db.select().from(distributionCollections).where(and(eq(distributionCollections.organizationId, organizationId), eq(distributionCollections.idempotencyKey, input.idempotencyKey))).limit(1);
  if (duplicate[0]) return { id: duplicate[0].id, replayed: true as const };
  const route = await assertOrganizationRecord((await db.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1))[0], "الجولة");
  const result = await db.insert(distributionCollections).values({ organizationId, receiptNumber: number("COL"), routeId: input.routeId, vehicleId: route.vehicleId, customerId: input.customerId, salesInvoiceId: input.salesInvoiceId, representativeEmployeeId: input.representativeEmployeeId, driverEmployeeId: input.driverEmployeeId, collectionType: input.collectionType, amount: String(input.amount), currencyCode: input.currencyCode.toUpperCase(), exchangeRateUsed: String(input.exchangeRateUsed ?? 1), paymentMethod: input.paymentMethod ?? "cash", idempotencyKey: input.idempotencyKey.trim(), createdByUserId: actorUserId });
  const id = Number(result[0].insertId);
  if (input.salesInvoiceId) await db.update(salesInvoices).set({ amountPaid: sql`${salesInvoices.amountPaid} + ${input.amount}`, status: "partial" }).where(and(eq(salesInvoices.id, input.salesInvoiceId), eq(salesInvoices.organizationId, organizationId)));
  await db.insert(distributionIdempotencyKeys).values({ organizationId, operation: "collection", idempotencyKey: input.idempotencyKey.trim(), entityType: "distribution_collection", entityId: id });
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_collection.recorded", entityType: "distribution_collection", entityId: String(id), metadata: { routeId: input.routeId, amount: input.amount } });
  return { id, replayed: false as const };
}

export async function getDistributionControlCenter(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [routesToday] = await db.select({ total: count() }).from(distributionRoutes).where(and(eq(distributionRoutes.organizationId, organizationId), sql`${distributionRoutes.routeDate} >= ${today}`));
  const [activeRoutes] = await db.select({ total: count() }).from(distributionRoutes).where(and(eq(distributionRoutes.organizationId, organizationId), sql`${distributionRoutes.status} in ('started','in_progress','returning')`));
  const [loadedVehicles] = await db.select({ total: count() }).from(vehicleLoadOrders).where(and(eq(vehicleLoadOrders.organizationId, organizationId), sql`${vehicleLoadOrders.status} in ('loaded','dispatched')`));
  const [pendingDeliveries] = await db.select({ total: count() }).from(distributionRouteStops).where(and(eq(distributionRouteStops.organizationId, organizationId), eq(distributionRouteStops.deliveryStatus, "pending")));
  const [completedDeliveries] = await db.select({ total: count() }).from(distributionDeliveries).where(and(eq(distributionDeliveries.organizationId, organizationId), sql`${distributionDeliveries.status} in ('full','partial')`));
  const [collectionTotal] = await db.select({ total: sql<string>`coalesce(sum(${distributionCollections.amount}), 0)` }).from(distributionCollections).where(eq(distributionCollections.organizationId, organizationId));
  const [returnTotal] = await db.select({ total: sql<string>`coalesce(sum(${distributionReturns.quantity}), 0)` }).from(distributionReturns).where(eq(distributionReturns.organizationId, organizationId));
  const [capacity] = await db.select({ total: sql<string>`coalesce(avg(${vehicleLoadOrders.payloadUtilization}), 0)` }).from(vehicleLoadOrders).where(and(eq(vehicleLoadOrders.organizationId, organizationId), sql`${vehicleLoadOrders.status} in ('loaded','dispatched')`));
  return { routesToday: Number(routesToday.total), activeRoutes: Number(activeRoutes.total), vehiclesLoaded: Number(loadedVehicles.total), pendingDeliveries: Number(pendingDeliveries.total), completedDeliveries: Number(completedDeliveries.total), collections: Number(collectionTotal.total), returns: Number(returnTotal.total), capacityUtilization: Number(capacity.total) };
}
