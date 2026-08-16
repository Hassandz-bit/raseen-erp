import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
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

export async function getDriverRouteFeed(organizationId: number, assignedRouteIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (!assignedRouteIds.length) return [];
  const routes = await db.select({ id: distributionRoutes.id, routeNumber: distributionRoutes.routeNumber, routeDate: distributionRoutes.routeDate, status: distributionRoutes.status, vehicleId: distributionRoutes.vehicleId, plannedStartAt: distributionRoutes.plannedStartAt, plannedEndAt: distributionRoutes.plannedEndAt, actualStartAt: distributionRoutes.actualStartAt, vehicleCode: fleetVehicles.code, vehicleRegistration: fleetVehicles.registrationNumber }).from(distributionRoutes).leftJoin(fleetVehicles, and(eq(fleetVehicles.id, distributionRoutes.vehicleId), eq(fleetVehicles.organizationId, distributionRoutes.organizationId))).where(and(eq(distributionRoutes.organizationId, organizationId), inArray(distributionRoutes.id, assignedRouteIds), inArray(distributionRoutes.status, ["prepared", "loaded", "started", "in_progress", "returning"]))).orderBy(asc(distributionRoutes.routeDate), asc(distributionRoutes.id));
  if (!routes.length) return [];
  const routeIds = routes.map(route => route.id);
  const stops = await db.select({ id: distributionRouteStops.id, routeId: distributionRouteStops.routeId, customerId: distributionRouteStops.customerId, sequence: distributionRouteStops.sequence, plannedAt: distributionRouteStops.plannedAt, arrivedAt: distributionRouteStops.arrivedAt, deliveryStatus: distributionRouteStops.deliveryStatus, notes: distributionRouteStops.notes, customerName: businessParties.name, customerAddress: businessParties.address, customerLatitude: businessParties.latitude, customerLongitude: businessParties.longitude, deliveryNotes: businessParties.deliveryNotes, receivingHours: businessParties.receivingHours, visitPriority: businessParties.visitPriority }).from(distributionRouteStops).innerJoin(businessParties, and(eq(businessParties.id, distributionRouteStops.customerId), eq(businessParties.organizationId, distributionRouteStops.organizationId))).where(and(eq(distributionRouteStops.organizationId, organizationId), inArray(distributionRouteStops.routeId, routeIds))).orderBy(asc(distributionRouteStops.routeId), asc(distributionRouteStops.sequence));
  return routes.map(route => ({ ...route, stops: stops.filter(stop => stop.routeId === route.id) }));
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
      const claimed = await tx.update(vehicleLoadOrders).set({ status: "loading" }).where(and(eq(vehicleLoadOrders.id, loadOrderId), eq(vehicleLoadOrders.organizationId, organizationId), eq(vehicleLoadOrders.status, load.status)));
      if (!Number(claimed[0]?.affectedRows ?? 0)) throw new Error("أمر التحميل قيد المعالجة أو تم إرساله بالفعل.");
      const vehicle = await assertOrganizationRecord((await tx.select().from(fleetVehicles).where(and(eq(fleetVehicles.id, load.vehicleId), eq(fleetVehicles.organizationId, organizationId))).limit(1))[0], "المركبة");
      const items = await tx.select().from(vehicleLoadItems).where(and(eq(vehicleLoadItems.organizationId, organizationId), eq(vehicleLoadItems.loadOrderId, loadOrderId)));
      for (const item of items) {
        if (!item.sourceBatchId) throw new Error("يتطلب كل سطر تحميل دفعة مصدر.");
        const sourceBatch = await assertOrganizationRecord((await tx.select().from(productBatches).where(and(eq(productBatches.id, item.sourceBatchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, load.sourceWarehouseId), eq(productBatches.status, "active"), sql`(${productBatches.expiryDate} IS NULL OR ${productBatches.expiryDate} > now())`)).limit(1))[0], "دفعة المصدر");
        const quantity = base(item.quantity);
        const sourceUpdated = await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} - ${quantity}` }).where(and(eq(productBatches.id, sourceBatch.id), eq(productBatches.organizationId, organizationId), sql`${productBatches.currentQuantity} - ${productBatches.reservedQuantity} >= ${quantity}`));
        if (!Number(sourceUpdated[0]?.affectedRows ?? 0)) throw new Error("تعذر صرف كمية التحميل بأمان.");
        const vehicleLotNumber = `${sourceBatch.lotNumber}-V`;
        const existingVehicleBatch = await tx.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, vehicle.mobileWarehouseId!), eq(productBatches.productId, item.productId), eq(productBatches.lotNumber, vehicleLotNumber))).limit(1);
        let vehicleBatchId: number;
        if (existingVehicleBatch[0]) {
          vehicleBatchId = existingVehicleBatch[0].id;
          await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} + ${quantity}`, receivedQuantity: sql`${productBatches.receivedQuantity} + ${quantity}` }).where(and(eq(productBatches.id, vehicleBatchId), eq(productBatches.organizationId, organizationId)));
        } else {
          const destination = await tx.insert(productBatches).values({ organizationId, productId: item.productId, warehouseId: vehicle.mobileWarehouseId!, lotNumber: vehicleLotNumber, sourcePartyId: sourceBatch.sourcePartyId, receivedQuantity: String(quantity), currentQuantity: String(quantity), reservedQuantity: "0", cost: sourceBatch.cost, manufacturingDate: sourceBatch.manufacturingDate, expiryDate: sourceBatch.expiryDate, status: "active" });
          vehicleBatchId = Number(destination[0].insertId);
        }
        await tx.update(vehicleLoadItems).set({ vehicleBatchId }).where(and(eq(vehicleLoadItems.id, item.id), eq(vehicleLoadItems.organizationId, organizationId)));
        await tx.insert(stockMovements).values([{ organizationId, warehouseId: load.sourceWarehouseId, productId: item.productId, batchId: sourceBatch.id, movementType: "vehicle_load_out", quantity: String(-quantity), unit: item.unit, sourceDocumentType: "vehicle_load", sourceDocumentId: loadOrderId, occurredAt: new Date(), actorUserId, auditReference: `LOAD-${loadOrderId}` }, { organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: item.productId, batchId: vehicleBatchId, movementType: "vehicle_load_in", quantity: String(quantity), unit: item.unit, sourceDocumentType: "vehicle_load", sourceDocumentId: loadOrderId, occurredAt: new Date(), actorUserId, auditReference: `LOAD-${loadOrderId}` }]);
        await tx.insert(inventoryBalances).values({ organizationId, warehouseId: load.sourceWarehouseId, productId: item.productId, quantity: String(-quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} - ${quantity}` } });
        await tx.insert(inventoryBalances).values({ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: item.productId, quantity: String(quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${quantity}` } });
      }
    }
    await tx.update(vehicleLoadOrders).set({ status, loadDate: status === "dispatched" ? new Date() : undefined, approvedByUserId: status === "approved" ? actorUserId : undefined }).where(and(eq(vehicleLoadOrders.id, loadOrderId), eq(vehicleLoadOrders.organizationId, organizationId), eq(vehicleLoadOrders.status, status === "dispatched" ? "loading" : load.status)));
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
    const customer = await assertOrganizationRecord((await tx.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId))).limit(1))[0], "العميل");
    if (input.salesInvoiceId) {
      const invoice = await assertOrganizationRecord((await tx.select().from(salesInvoices).where(and(eq(salesInvoices.id, input.salesInvoiceId), eq(salesInvoices.organizationId, organizationId))).limit(1))[0], "فاتورة المبيعات");
      if (invoice.customerId !== customer.id) throw new Error("لا تطابق الفاتورة العميل المحدد للتسليم.");
    }
    if (input.stopId) await assertOrganizationRecord((await tx.select().from(distributionRouteStops).where(and(eq(distributionRouteStops.id, input.stopId), eq(distributionRouteStops.organizationId, organizationId), eq(distributionRouteStops.routeId, input.routeId), eq(distributionRouteStops.customerId, input.customerId))).limit(1))[0], "محطة الجولة");
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
  const customer = await assertOrganizationRecord((await db.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId))).limit(1))[0], "العميل");
  if (input.salesInvoiceId) {
    const invoice = await assertOrganizationRecord((await db.select().from(salesInvoices).where(and(eq(salesInvoices.id, input.salesInvoiceId), eq(salesInvoices.organizationId, organizationId))).limit(1))[0], "فاتورة المبيعات");
    if (invoice.customerId !== customer.id) throw new Error("لا تطابق الفاتورة العميل المحدد للتحصيل.");
  }
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

export async function recordDistributionReturn(organizationId: number, actorUserId: number, input: { routeId: number; customerId?: number; deliveryId?: number; salesInvoiceId?: number; productId: number; vehicleBatchId: number; quantity: number; unit: string; reason?: string; condition: "resalable" | "damaged" | "quarantined"; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const duplicate = await tx.select().from(distributionReturns).where(and(eq(distributionReturns.organizationId, organizationId), eq(distributionReturns.idempotencyKey, input.idempotencyKey))).limit(1);
    if (duplicate[0]) return { id: duplicate[0].id, replayed: true as const };
    const route = await assertOrganizationRecord((await tx.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1))[0], "الجولة");
    if (!route.vehicleId) throw new Error("لا يمكن تسجيل مرتجع بلا مركبة مسندة للجولة.");
    if (input.customerId) await assertOrganizationRecord((await tx.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId))).limit(1))[0], "العميل");
    if (input.salesInvoiceId) await assertOrganizationRecord((await tx.select().from(salesInvoices).where(and(eq(salesInvoices.id, input.salesInvoiceId), eq(salesInvoices.organizationId, organizationId))).limit(1))[0], "فاتورة المبيعات");
    if (input.deliveryId) await assertOrganizationRecord((await tx.select().from(distributionDeliveries).where(and(eq(distributionDeliveries.id, input.deliveryId), eq(distributionDeliveries.organizationId, organizationId), eq(distributionDeliveries.routeId, input.routeId))).limit(1))[0], "مستند التسليم");
    const vehicle = await assertOrganizationRecord((await tx.select().from(fleetVehicles).where(and(eq(fleetVehicles.id, route.vehicleId), eq(fleetVehicles.organizationId, organizationId))).limit(1))[0], "المركبة");
    const batch = await assertOrganizationRecord((await tx.select().from(productBatches).where(and(eq(productBatches.id, input.vehicleBatchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, vehicle.mobileWarehouseId!), eq(productBatches.productId, input.productId))).limit(1))[0], "دفعة المركبة");
    const result = await tx.insert(distributionReturns).values({ organizationId, returnNumber: number("RET"), routeId: input.routeId, vehicleId: route.vehicleId, customerId: input.customerId, deliveryId: input.deliveryId, salesInvoiceId: input.salesInvoiceId, productId: input.productId, vehicleBatchId: input.vehicleBatchId, quantity: String(input.quantity), unit: input.unit, reason: input.reason?.trim(), condition: input.condition, status: input.condition === "resalable" ? "recorded" : "damaged", idempotencyKey: input.idempotencyKey.trim(), createdByUserId: actorUserId });
    const id = Number(result[0].insertId);
    if (input.condition === "resalable") {
      await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} + ${input.quantity}` }).where(and(eq(productBatches.id, batch.id), eq(productBatches.organizationId, organizationId)));
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: input.productId, quantity: String(input.quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${input.quantity}` } });
    } else {
      const quarantine = await tx.insert(productBatches).values({ organizationId, productId: input.productId, warehouseId: vehicle.mobileWarehouseId!, lotNumber: `RET-${id}`, receivedQuantity: String(input.quantity), currentQuantity: String(input.quantity), reservedQuantity: "0", cost: batch.cost, status: "quarantined" });
      await tx.update(distributionReturns).set({ vehicleBatchId: Number(quarantine[0].insertId) }).where(and(eq(distributionReturns.id, id), eq(distributionReturns.organizationId, organizationId)));
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: input.productId, quantity: String(input.quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${input.quantity}` } });
    }
    await tx.insert(stockMovements).values({ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: input.productId, batchId: input.condition === "resalable" ? batch.id : undefined, movementType: "vehicle_return", quantity: String(input.quantity), unit: input.unit, sourceDocumentType: "distribution_return", sourceDocumentId: id, occurredAt: new Date(), actorUserId, auditReference: `RET-${id}` });
    await tx.insert(distributionIdempotencyKeys).values({ organizationId, operation: "return", idempotencyKey: input.idempotencyKey.trim(), entityType: "distribution_return", entityId: id });
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_return.recorded", entityType: "distribution_return", entityId: String(id), metadata: { routeId: input.routeId, condition: input.condition } });
    return { id, replayed: false as const };
  });
}

export async function returnVehicleStockToWarehouse(organizationId: number, actorUserId: number, input: { vehicleId: number; destinationWarehouseId: number; vehicleBatchId: number; quantity: number; unit: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const vehicle = await assertOrganizationRecord((await tx.select().from(fleetVehicles).where(and(eq(fleetVehicles.id, input.vehicleId), eq(fleetVehicles.organizationId, organizationId))).limit(1))[0], "المركبة");
    await assertOrganizationRecord((await tx.select().from(warehouses).where(and(eq(warehouses.id, input.destinationWarehouseId), eq(warehouses.organizationId, organizationId), eq(warehouses.status, "active"))).limit(1))[0], "مخزن الوجهة");
    const vehicleBatch = await assertOrganizationRecord((await tx.select().from(productBatches).where(and(eq(productBatches.id, input.vehicleBatchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, vehicle.mobileWarehouseId!))).limit(1))[0], "دفعة المركبة");
    if (base(vehicleBatch.currentQuantity) < input.quantity) throw new Error("كمية مركبة غير كافية للترجيع إلى المخزن.");
    await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} - ${input.quantity}` }).where(and(eq(productBatches.id, vehicleBatch.id), eq(productBatches.organizationId, organizationId), sql`${productBatches.currentQuantity} >= ${input.quantity}`));
    const existing = await tx.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, input.destinationWarehouseId), eq(productBatches.productId, vehicleBatch.productId), eq(productBatches.lotNumber, vehicleBatch.lotNumber))).limit(1);
    let destinationBatchId: number;
    if (existing[0]) {
      destinationBatchId = existing[0].id;
      await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} + ${input.quantity}`, receivedQuantity: sql`${productBatches.receivedQuantity} + ${input.quantity}` }).where(and(eq(productBatches.id, destinationBatchId), eq(productBatches.organizationId, organizationId)));
    } else {
      const inserted = await tx.insert(productBatches).values({ organizationId, productId: vehicleBatch.productId, warehouseId: input.destinationWarehouseId, lotNumber: vehicleBatch.lotNumber, sourcePartyId: vehicleBatch.sourcePartyId, receivedQuantity: String(input.quantity), currentQuantity: String(input.quantity), reservedQuantity: "0", cost: vehicleBatch.cost, manufacturingDate: vehicleBatch.manufacturingDate, expiryDate: vehicleBatch.expiryDate, status: vehicleBatch.status });
      destinationBatchId = Number(inserted[0].insertId);
    }
    await tx.insert(stockMovements).values([{ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: vehicleBatch.productId, batchId: vehicleBatch.id, movementType: "vehicle_return", quantity: String(-input.quantity), unit: input.unit, sourceDocumentType: "vehicle_return_to_warehouse", sourceDocumentId: input.vehicleBatchId, occurredAt: new Date(), actorUserId, auditReference: `VRET-${input.vehicleBatchId}` }, { organizationId, warehouseId: input.destinationWarehouseId, productId: vehicleBatch.productId, batchId: destinationBatchId, movementType: "vehicle_load_in", quantity: String(input.quantity), unit: input.unit, sourceDocumentType: "vehicle_return_to_warehouse", sourceDocumentId: input.vehicleBatchId, occurredAt: new Date(), actorUserId, auditReference: `VRET-${input.vehicleBatchId}` }]);
    await tx.insert(inventoryBalances).values({ organizationId, warehouseId: vehicle.mobileWarehouseId!, productId: vehicleBatch.productId, quantity: String(-input.quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} - ${input.quantity}` } });
    await tx.insert(inventoryBalances).values({ organizationId, warehouseId: input.destinationWarehouseId, productId: vehicleBatch.productId, quantity: String(input.quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${input.quantity}` } });
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "vehicle_stock.returned_to_warehouse", entityType: "product_batch", entityId: String(input.vehicleBatchId), metadata: { destinationWarehouseId: input.destinationWarehouseId, quantity: input.quantity } });
    return { destinationBatchId };
  });
}

export async function listVehicleInventory(organizationId: number, vehicleId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const vehicle = await assertVehicle(db, organizationId, vehicleId);
  return db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, vehicle.mobileWarehouseId!))).orderBy(asc(productBatches.expiryDate), desc(productBatches.createdAt)).limit(300);
}

export async function addDistributionRouteExpense(organizationId: number, actorUserId: number, input: { routeId: number; vehicleId?: number; category: "fuel" | "toll" | "parking" | "minor"; amount: number; currencyCode: string; receiptUrl?: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const route = await assertOrganizationRecord((await db.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1))[0], "الجولة");
  if (input.vehicleId && route.vehicleId !== input.vehicleId) throw new Error("لا تتبع المركبة المحددة لهذه الجولة.");
  const result = await db.insert(distributionRouteExpenses).values({ organizationId, routeId: input.routeId, vehicleId: route.vehicleId, category: input.category, amount: String(input.amount), currencyCode: input.currencyCode.toUpperCase(), receiptUrl: input.receiptUrl, notes: input.notes?.trim(), createdByUserId: actorUserId });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_route.expense_recorded", entityType: "distribution_route_expense", entityId: String(id), metadata: { routeId: input.routeId, amount: input.amount } });
  return { id };
}

async function calculateRouteValue(tx: { select: (...args: any[]) => any }, organizationId: number, rows: Array<{ productId: number; quantity: unknown }>) {
  let value = 0;
  for (const row of rows) {
    const product = (await tx.select({ salePrice: products.salePrice }).from(products).where(and(eq(products.id, row.productId), eq(products.organizationId, organizationId))).limit(1))[0];
    value += base(product?.salePrice) * base(row.quantity);
  }
  return value;
}

export async function submitRouteClosing(organizationId: number, actorUserId: number, input: { routeId: number; actualCash: number; stockDifference?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const route = await assertOrganizationRecord((await tx.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1))[0], "الجولة");
    if (!["returning", "closing"].includes(route.status)) throw new Error("لا يمكن تسوية جولة لم تعد من التوزيع.");
    const previous = await tx.select().from(distributionRouteClosings).where(and(eq(distributionRouteClosings.organizationId, organizationId), eq(distributionRouteClosings.routeId, input.routeId))).limit(1);
    if (previous[0] && previous[0].status !== "reopened") throw new Error("توجد تسوية نشطة لهذه الجولة.");
    const loadItems = route.loadOrderId ? await tx.select({ productId: vehicleLoadItems.productId, quantity: vehicleLoadItems.quantity }).from(vehicleLoadItems).where(and(eq(vehicleLoadItems.organizationId, organizationId), eq(vehicleLoadItems.loadOrderId, route.loadOrderId))) : [];
    const deliveryRows = await tx.select({ productId: distributionDeliveryItems.productId, quantity: distributionDeliveryItems.deliveredQuantity }).from(distributionDeliveryItems).innerJoin(distributionDeliveries, eq(distributionDeliveries.id, distributionDeliveryItems.deliveryId)).where(and(eq(distributionDeliveryItems.organizationId, organizationId), eq(distributionDeliveries.organizationId, organizationId), eq(distributionDeliveries.routeId, input.routeId)));
    const returnRows = await tx.select({ productId: distributionReturns.productId, quantity: distributionReturns.quantity, condition: distributionReturns.condition }).from(distributionReturns).where(and(eq(distributionReturns.organizationId, organizationId), eq(distributionReturns.routeId, input.routeId)));
    const collections = await tx.select({ amount: distributionCollections.amount }).from(distributionCollections).where(and(eq(distributionCollections.organizationId, organizationId), eq(distributionCollections.routeId, input.routeId), eq(distributionCollections.paymentMethod, "cash")));
    const loadedValue = await calculateRouteValue(tx, organizationId, loadItems);
    const deliveredValue = await calculateRouteValue(tx, organizationId, deliveryRows);
    const returnedValue = await calculateRouteValue(tx, organizationId, returnRows.filter(row => row.condition === "resalable"));
    const damagedValue = await calculateRouteValue(tx, organizationId, returnRows.filter(row => row.condition !== "resalable"));
    const expectedCash = collections.reduce((total, row) => total + base(row.amount), 0);
    const values = { loadedValue: String(loadedValue), deliveredValue: String(deliveredValue), returnedValue: String(returnedValue), damagedValue: String(damagedValue), expectedCash: String(expectedCash), actualCash: String(input.actualCash), cashDifference: String(input.actualCash - expectedCash), stockDifference: String(input.stockDifference ?? 0), status: "submitted" as const, submittedByUserId: actorUserId, reopenReason: undefined };
    let id: number;
    if (previous[0]) {
      id = previous[0].id;
      await tx.update(distributionRouteClosings).set(values).where(and(eq(distributionRouteClosings.id, id), eq(distributionRouteClosings.organizationId, organizationId), eq(distributionRouteClosings.status, "reopened")));
    } else {
      const created = await tx.insert(distributionRouteClosings).values({ organizationId, routeId: input.routeId, ...values });
      id = Number(created[0].insertId);
    }
    await tx.update(distributionRoutes).set({ status: "closing" }).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId), sql`${distributionRoutes.status} in ('returning','closing')`));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "distribution_route.closing_submitted", entityType: "distribution_route_closing", entityId: String(id), metadata: { routeId: input.routeId, expectedCash, actualCash: input.actualCash } });
    return { id, expectedCash, cashDifference: input.actualCash - expectedCash };
  });
}

export async function transitionRouteClosing(organizationId: number, actorUserId: number, input: { closingId: number; status: "reviewed" | "approved" | "closed" | "reopened"; reopenReason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const closing = await assertOrganizationRecord((await tx.select().from(distributionRouteClosings).where(and(eq(distributionRouteClosings.id, input.closingId), eq(distributionRouteClosings.organizationId, organizationId))).limit(1))[0], "تسوية الجولة");
    if (!canTransitionRouteClosing(closing.status, input.status)) throw new Error("لا يسمح انتقال حالة التسوية من وضعها الحالي.");
    if (input.status === "reopened" && !input.reopenReason?.trim()) throw new Error("تتطلب إعادة فتح الجولة سبباً موثقاً.");
    const actorField = input.status === "reviewed" ? { reviewedByUserId: actorUserId } : input.status === "approved" ? { approvedByUserId: actorUserId } : input.status === "closed" ? { closedByUserId: actorUserId } : {};
    await tx.update(distributionRouteClosings).set({ status: input.status, reopenReason: input.status === "reopened" ? input.reopenReason?.trim() : undefined, ...actorField }).where(and(eq(distributionRouteClosings.id, input.closingId), eq(distributionRouteClosings.organizationId, organizationId), eq(distributionRouteClosings.status, closing.status)));
    if (input.status === "closed") await tx.update(distributionRoutes).set({ status: "closed", actualEndAt: new Date() }).where(and(eq(distributionRoutes.id, closing.routeId), eq(distributionRoutes.organizationId, organizationId), eq(distributionRoutes.status, "closing")));
    if (input.status === "reopened") await tx.update(distributionRoutes).set({ status: "returning" }).where(and(eq(distributionRoutes.id, closing.routeId), eq(distributionRoutes.organizationId, organizationId), eq(distributionRoutes.status, "closing")));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: `distribution_route_closing.${input.status}`, entityType: "distribution_route_closing", entityId: String(input.closingId), metadata: { routeId: closing.routeId, reopenReason: input.reopenReason?.trim() ?? null } });
    return { id: input.closingId, status: input.status };
  });
}

export async function recordFleetGpsPoint(organizationId: number, actorUserId: number, input: { vehicleId: number; routeId?: number; latitude: number; longitude: number; accuracy?: number; recordedAt: Date; source: "driver_app" | "vehicle_tracker" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await assertVehicle(db, organizationId, input.vehicleId);
  if (input.routeId) {
    const route = await assertOrganizationRecord((await db.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId), eq(distributionRoutes.vehicleId, input.vehicleId))).limit(1))[0], "جولة المركبة");
    if (!["started", "in_progress", "returning"].includes(route.status)) throw new Error("لا يمكن حفظ موقع لجولة غير نشطة.");
  }
  const result = await db.insert(fleetGpsRecords).values({ organizationId, userId: actorUserId, vehicleId: input.vehicleId, routeId: input.routeId, latitude: String(input.latitude), longitude: String(input.longitude), accuracy: input.accuracy === undefined ? undefined : String(input.accuracy), recordedAt: input.recordedAt, source: input.source });
  return { id: Number(result[0].insertId) };
}

export async function recordGeofenceEvent(organizationId: number, actorUserId: number, input: { routeId: number; stopId: number; vehicleId?: number; eventType: "arrival" | "departure"; distanceMeters?: number; recordedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const route = await assertOrganizationRecord((await db.select().from(distributionRoutes).where(and(eq(distributionRoutes.id, input.routeId), eq(distributionRoutes.organizationId, organizationId))).limit(1))[0], "الجولة");
  if (input.vehicleId && route.vehicleId !== input.vehicleId) throw new Error("لا تتبع المركبة المحددة لهذه الجولة.");
  await assertOrganizationRecord((await db.select().from(distributionRouteStops).where(and(eq(distributionRouteStops.id, input.stopId), eq(distributionRouteStops.organizationId, organizationId), eq(distributionRouteStops.routeId, input.routeId))).limit(1))[0], "محطة الجولة");
  const result = await db.insert(distributionGeofenceEvents).values({ organizationId, routeId: input.routeId, stopId: input.stopId, vehicleId: route.vehicleId, eventType: input.eventType, distanceMeters: input.distanceMeters === undefined ? undefined : String(input.distanceMeters), recordedAt: input.recordedAt });
  if (input.eventType === "arrival") await db.update(distributionRouteStops).set({ arrivedAt: input.recordedAt, deliveryStatus: "arrived" }).where(and(eq(distributionRouteStops.id, input.stopId), eq(distributionRouteStops.organizationId, organizationId), eq(distributionRouteStops.routeId, input.routeId), eq(distributionRouteStops.deliveryStatus, "pending")));
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: `distribution_geofence.${input.eventType}`, entityType: "distribution_route_stop", entityId: String(input.stopId), metadata: { routeId: input.routeId, distanceMeters: input.distanceMeters ?? null } });
  return { id: Number(result[0].insertId) };
}

export async function getLatestFleetLocations(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(fleetGpsRecords).where(eq(fleetGpsRecords.organizationId, organizationId)).orderBy(desc(fleetGpsRecords.recordedAt), desc(fleetGpsRecords.id)).limit(200);
}

export async function getDistributionOwnerAlertReasons(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 30);
  const documents = await db.select({ documentType: fleetVehicleDocuments.documentType, expiresAt: fleetVehicleDocuments.expiresAt, vehicleCode: fleetVehicles.code }).from(fleetVehicleDocuments).innerJoin(fleetVehicles, and(eq(fleetVehicles.id, fleetVehicleDocuments.vehicleId), eq(fleetVehicles.organizationId, fleetVehicleDocuments.organizationId))).where(and(eq(fleetVehicleDocuments.organizationId, organizationId), sql`${fleetVehicleDocuments.expiresAt} IS NOT NULL AND ${fleetVehicleDocuments.expiresAt} <= ${threshold}`)).limit(20);
  const maintenance = await db.select({ vehicleCode: fleetVehicles.code, nextDueAt: fleetMaintenanceRecords.nextDueAt }).from(fleetMaintenanceRecords).innerJoin(fleetVehicles, and(eq(fleetVehicles.id, fleetMaintenanceRecords.vehicleId), eq(fleetVehicles.organizationId, fleetMaintenanceRecords.organizationId))).where(and(eq(fleetMaintenanceRecords.organizationId, organizationId), sql`${fleetMaintenanceRecords.nextDueAt} IS NOT NULL AND ${fleetMaintenanceRecords.nextDueAt} <= ${threshold}`, sql`${fleetMaintenanceRecords.status} not in ('completed','cancelled')`)).limit(20);
  return [
    ...documents.map(item => `وثيقة ${item.documentType} للمركبة ${item.vehicleCode} تنتهي أو انتهت في ${item.expiresAt?.toISOString().slice(0, 10)}.`),
    ...maintenance.map(item => `صيانة المركبة ${item.vehicleCode} مستحقة في ${item.nextDueAt?.toISOString().slice(0, 10)}.`),
  ];
}
