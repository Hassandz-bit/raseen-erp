import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, manufacturingBomItems, manufacturingBoms, productBatches, productionMaterialReservations, productionOrders, productionStages, products, warehouses } from "../drizzle/schema";
import { getDb, previewFefoAllocation, recordStockMovement } from "./db";
import { canTransitionProductionOrder, type ProductionStatus } from "./manufacturingPolicy";

const productionNumber = () => `PO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export async function createManufacturingBom(organizationId: number, actorUserId: number, input: { code: string; version: string; productId: number; outputQuantity: number; outputUnit: string; notes?: string; items: Array<{ componentProductId: number; quantity: number; unit: string; baseQuantity: number; wasteAllowance?: number; stageCode?: string; required?: "yes" | "no" }> }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.outputQuantity <= 0 || !input.items.length) throw new Error("يلزم مخرج موجب وبند BOM واحد على الأقل.");
  const validProducts = await db.select({ id: products.id }).from(products).where(and(eq(products.organizationId, organizationId), inArray(products.id, [input.productId, ...input.items.map(item => item.componentProductId)])));
  if (validProducts.length !== input.items.length + 1) throw new Error("أحد منتجات BOM خارج نطاق المؤسسة.");
  return db.transaction(async tx => {
    const inserted = await tx.insert(manufacturingBoms).values({ organizationId, productId: input.productId, code: input.code.trim().toUpperCase(), version: input.version.trim(), outputQuantity: String(input.outputQuantity), outputUnit: input.outputUnit, notes: input.notes?.trim(), createdByUserId: actorUserId });
    const bomId = Number(inserted[0].insertId);
    await tx.insert(manufacturingBomItems).values(input.items.map(item => ({ organizationId, bomId, componentProductId: item.componentProductId, quantity: String(item.quantity), unit: item.unit, baseQuantity: String(item.baseQuantity), wasteAllowance: String(item.wasteAllowance ?? 0), stageCode: item.stageCode, required: item.required ?? "yes" })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.bom_created", entityType: "manufacturing_bom", entityId: String(bomId), metadata: { code: input.code, version: input.version } });
    return { id: bomId };
  });
}

export async function createProductionOrder(organizationId: number, actorUserId: number, input: { bomId: number; plannedQuantity: number; plannedUnit: string; baseQuantity: number; rawMaterialWarehouseId: number; finishedGoodsWarehouseId: number; branchId?: number; responsibleUserId?: number }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.plannedQuantity <= 0 || input.baseQuantity <= 0) throw new Error("كمية الإنتاج يجب أن تكون أكبر من صفر.");
  const [bom] = await db.select().from(manufacturingBoms).where(and(eq(manufacturingBoms.id, input.bomId), eq(manufacturingBoms.organizationId, organizationId), eq(manufacturingBoms.status, "active"))).limit(1);
  const activeWarehouses = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.organizationId, organizationId), inArray(warehouses.id, [input.rawMaterialWarehouseId, input.finishedGoodsWarehouseId]), eq(warehouses.status, "active")));
  if (!bom || activeWarehouses.length !== 2) throw new Error("BOM أو مخازن الإنتاج غير متاحة ضمن المؤسسة.");
  const inserted = await db.insert(productionOrders).values({ organizationId, branchId: input.branchId, orderNumber: productionNumber(), productId: bom.productId, bomId: bom.id, bomVersion: bom.version, plannedQuantity: String(input.plannedQuantity), plannedUnit: input.plannedUnit, baseQuantity: String(input.baseQuantity), rawMaterialWarehouseId: input.rawMaterialWarehouseId, finishedGoodsWarehouseId: input.finishedGoodsWarehouseId, responsibleUserId: input.responsibleUserId, createdByUserId: actorUserId });
  const productionOrderId = Number(inserted[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.order_created", entityType: "production_order", entityId: String(productionOrderId), metadata: { bomId: bom.id } });
  return { id: productionOrderId };
}

export async function reserveProductionMaterials(organizationId: number, actorUserId: number, productionOrderId: number, overrideReason?: string) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId))).limit(1);
  if (!order || !canTransitionProductionOrder(order.status as ProductionStatus, "materials_reserved")) throw new Error("لا يمكن حجز مواد أمر الإنتاج في حالته الحالية.");
  const items = await db.select().from(manufacturingBomItems).where(and(eq(manufacturingBomItems.bomId, order.bomId), eq(manufacturingBomItems.organizationId, organizationId)));
  const ratio = Number(order.baseQuantity) / Number((await db.select({ output: manufacturingBoms.outputQuantity }).from(manufacturingBoms).where(eq(manufacturingBoms.id, order.bomId)).limit(1))[0]?.output ?? 1);
  const reservations: Array<{ organizationId: number; productionOrderId: number; bomItemId: number; productId: number; batchId?: number; requiredQuantity: string; availableQuantity: string; reservedQuantity: string; shortageQuantity: string; overrideReason?: string; overrideByUserId?: number }> = [];
  for (const item of items) {
    const required = Number(item.baseQuantity) * ratio * (1 + Number(item.wasteAllowance) / 100);
    const preview = await previewFefoAllocation(organizationId, order.rawMaterialWarehouseId, item.componentProductId, required);
    for (const allocation of preview.allocations) reservations.push({ organizationId, productionOrderId, bomItemId: item.id, productId: item.componentProductId, batchId: allocation.batchId, requiredQuantity: String(required), availableQuantity: String(required - preview.remainingQuantity), reservedQuantity: String(allocation.quantity), shortageQuantity: "0" });
    if (!preview.allocations.length || preview.remainingQuantity > 0) reservations.push({ organizationId, productionOrderId, bomItemId: item.id, productId: item.componentProductId, requiredQuantity: String(required), availableQuantity: String(required - preview.remainingQuantity), reservedQuantity: "0", shortageQuantity: String(preview.remainingQuantity), overrideReason: preview.remainingQuantity > 0 ? overrideReason : undefined, overrideByUserId: preview.remainingQuantity > 0 && overrideReason ? actorUserId : undefined });
    if (preview.remainingQuantity > 0 && order.shortagePolicy === "block" && !overrideReason) throw new Error("يوجد نقص مواد، ولا تسمح سياسة الأمر بالتجاوز.");
  }
  await db.transaction(async tx => {
    for (const reservation of reservations) {
      if (!reservation.batchId || Number(reservation.reservedQuantity) <= 0) continue;
      const locked = await tx.update(productBatches).set({ reservedQuantity: sql`${productBatches.reservedQuantity} + ${reservation.reservedQuantity}` }).where(and(eq(productBatches.id, reservation.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, order.rawMaterialWarehouseId), sql`${productBatches.currentQuantity} - ${productBatches.reservedQuantity} >= ${reservation.reservedQuantity}`));
      if (!locked[0]?.affectedRows) throw new Error("تغيرت الكمية المتاحة لإحدى الدفعات أثناء الحجز، يرجى إعادة المحاولة.");
    }
    await tx.insert(productionMaterialReservations).values(reservations);
    await tx.update(productionOrders).set({ status: "materials_reserved" }).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.materials_reserved", entityType: "production_order", entityId: String(productionOrderId), metadata: { overrideReason, reservationCount: reservations.length } });
  });
  return { reservations };
}

export async function issueMaterialsForProduction(organizationId: number, actorUserId: number, productionOrderId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId))).limit(1);
  if (!order || !canTransitionProductionOrder(order.status as ProductionStatus, "in_production")) throw new Error("لا يمكن سحب مواد أمر الإنتاج في حالته الحالية.");
  const reservations = await db.select().from(productionMaterialReservations).where(and(eq(productionMaterialReservations.organizationId, organizationId), eq(productionMaterialReservations.productionOrderId, productionOrderId)));
  if (!reservations.length || reservations.some(row => Number(row.shortageQuantity) > 0)) throw new Error("لا يمكن بدء الإنتاج بوجود نقص مواد غير معالج.");
  const bomItems = await db.select().from(manufacturingBomItems).where(and(eq(manufacturingBomItems.organizationId, organizationId), eq(manufacturingBomItems.bomId, order.bomId)));
  const unitByBomItemId = new Map(bomItems.map(item => [item.id, item.unit]));
  const issued: Array<{ reservationId: number; batchId: number; quantity: number }> = [];
  for (const reservation of reservations) {
    const remaining = Number(reservation.reservedQuantity) - Number(reservation.issuedQuantity);
    if (!reservation.batchId || remaining <= 0) continue;
    await recordStockMovement({ organizationId, warehouseId: order.rawMaterialWarehouseId, productId: reservation.productId, batchId: reservation.batchId, movementType: "production_issue", quantity: -remaining, unit: unitByBomItemId.get(reservation.bomItemId) ?? "قطعة", actorUserId, sourceDocumentType: "production_order", sourceDocumentId: productionOrderId });
    await db.transaction(async tx => {
      await tx.update(productBatches).set({ reservedQuantity: sql`greatest(${productBatches.reservedQuantity} - ${remaining}, 0)` }).where(and(eq(productBatches.id, reservation.batchId!), eq(productBatches.organizationId, organizationId)));
      await tx.update(productionMaterialReservations).set({ issuedQuantity: sql`${productionMaterialReservations.issuedQuantity} + ${remaining}` }).where(and(eq(productionMaterialReservations.id, reservation.id), eq(productionMaterialReservations.organizationId, organizationId)));
    });
    issued.push({ reservationId: reservation.id, batchId: reservation.batchId, quantity: remaining });
  }
  await db.transaction(async tx => {
    await tx.update(productionOrders).set({ status: "in_production", actualStart: order.actualStart ?? new Date() }).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.materials_issued", entityType: "production_order", entityId: String(productionOrderId), metadata: { issued } });
  });
  return { issued };
}

export async function returnMaterialsFromProduction(organizationId: number, actorUserId: number, productionOrderId: number, items: Array<{ reservationId: number; quantity: number }>) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId), eq(productionOrders.status, "in_production"))).limit(1);
  if (!order || !items.length) throw new Error("لا يمكن إرجاع مواد لهذا الأمر في حالته الحالية.");
  const reservations = await db.select().from(productionMaterialReservations).where(and(eq(productionMaterialReservations.organizationId, organizationId), eq(productionMaterialReservations.productionOrderId, productionOrderId), inArray(productionMaterialReservations.id, items.map(item => item.reservationId))));
  if (reservations.length !== items.length) throw new Error("إحدى حجوزات المواد خارج نطاق أمر الإنتاج أو المؤسسة.");
  const bomItems = await db.select().from(manufacturingBomItems).where(and(eq(manufacturingBomItems.organizationId, organizationId), eq(manufacturingBomItems.bomId, order.bomId)));
  const unitByBomItemId = new Map(bomItems.map(item => [item.id, item.unit]));
  for (const item of items) {
    const reservation = reservations.find(row => row.id === item.reservationId)!;
    const returnable = Number(reservation.issuedQuantity) - Number(reservation.returnedQuantity);
    if (!reservation.batchId || item.quantity <= 0 || item.quantity > returnable) throw new Error("كمية إرجاع المادة غير صالحة لحجزها.");
    await recordStockMovement({ organizationId, warehouseId: order.rawMaterialWarehouseId, productId: reservation.productId, batchId: reservation.batchId, movementType: "production_return", quantity: item.quantity, unit: unitByBomItemId.get(reservation.bomItemId) ?? "قطعة", actorUserId, sourceDocumentType: "production_order", sourceDocumentId: productionOrderId });
    await db.update(productionMaterialReservations).set({ returnedQuantity: sql`${productionMaterialReservations.returnedQuantity} + ${item.quantity}` }).where(and(eq(productionMaterialReservations.id, reservation.id), eq(productionMaterialReservations.organizationId, organizationId)));
  }
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.materials_returned", entityType: "production_order", entityId: String(productionOrderId), metadata: { items } });
  return { returnedCount: items.length };
}

export async function transitionProductionOrderStatus(organizationId: number, actorUserId: number, productionOrderId: number, nextStatus: ProductionStatus) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (nextStatus === "materials_reserved") throw new Error("يتم الانتقال إلى حالة حجز المواد عبر إجراء الحجز فقط.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId))).limit(1);
  if (!order || !canTransitionProductionOrder(order.status as ProductionStatus, nextStatus)) throw new Error("لا يمكن تغيير حالة أمر الإنتاج من وضعه الحالي.");
  const timestamps = nextStatus === "in_production" ? { actualStart: new Date() } : nextStatus === "completed" ? { actualEnd: new Date() } : {};
  await db.transaction(async tx => {
    await tx.update(productionOrders).set({ status: nextStatus, ...timestamps }).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.order_status_changed", entityType: "production_order", entityId: String(productionOrderId), metadata: { from: order.status, to: nextStatus } });
  });
  return { id: productionOrderId, status: nextStatus };
}
