import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, manufacturingBomItems, manufacturingBoms, organizationExchangeRates, organizations, productBatches, productionMaterialReservations, productionOrders, productionStages, products, warehouses } from "../drizzle/schema";
import { manufacturingProductProfiles, productionExpenses, productionOutputs, productionQualityChecks } from "../drizzle/manufacturingSchema";
import { createProductBatch, getDb, previewFefoAllocation, recordStockMovement } from "./db";
import { calculateUnitProductionCost, canTransitionProductionOrder, type ProductionStatus } from "./manufacturingPolicy";

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
  const bomItems = await db.select({ stageCode: manufacturingBomItems.stageCode }).from(manufacturingBomItems).where(and(eq(manufacturingBomItems.organizationId, organizationId), eq(manufacturingBomItems.bomId, bom.id)));
  const stageCodes = Array.from(new Set(bomItems.flatMap(item => item.stageCode ? [item.stageCode] : [])));
  if (stageCodes.length) await db.insert(productionStages).values(stageCodes.map((code, index) => ({ organizationId, productionOrderId, sequence: index + 1, code, name: code, responsibleUserId: input.responsibleUserId })));
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

export async function recordProductionOutput(organizationId: number, actorUserId: number, productionOrderId: number, input: { lotNumber: string; goodQuantity: number; defectiveQuantity?: number; reworkQuantity?: number; scrapQuantity?: number; manufacturingDate?: Date; expiryDate?: Date }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.goodQuantity <= 0) throw new Error("يجب أن تكون كمية المنتج الجيد أكبر من صفر.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId), eq(productionOrders.status, "in_production"))).limit(1);
  if (!order) throw new Error("لا يمكن تسجيل مخرجات لهذا الأمر في حالته الحالية.");
  const [profile] = await db.select().from(manufacturingProductProfiles).where(and(eq(manufacturingProductProfiles.organizationId, organizationId), eq(manufacturingProductProfiles.productId, order.productId))).limit(1);
  const reservations = await db.select().from(productionMaterialReservations).where(and(eq(productionMaterialReservations.organizationId, organizationId), eq(productionMaterialReservations.productionOrderId, productionOrderId)));
  const batchIds = reservations.flatMap(row => row.batchId ? [row.batchId] : []);
  const consumedBatches = batchIds.length ? await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), inArray(productBatches.id, batchIds))) : [];
  const batchCostById = new Map(consumedBatches.map(batch => [batch.id, Number(batch.cost)]));
  const materialCost = reservations.reduce((total, row) => total + Math.max(0, Number(row.issuedQuantity) - Number(row.returnedQuantity)) * (row.batchId ? batchCostById.get(row.batchId) ?? 0 : 0), 0);
  const expenses = await db.select().from(productionExpenses).where(and(eq(productionExpenses.organizationId, organizationId), eq(productionExpenses.productionOrderId, productionOrderId)));
  const directCost = expenses.reduce((total, expense) => total + Number(expense.amount) * Number(expense.exchangeRateSnapshot ?? 1), 0);
  const unitCost = calculateUnitProductionCost({ materialCost, overheadCost: directCost, goodQuantity: input.goodQuantity });
  const manufacturingDate = input.manufacturingDate ?? new Date();
  const suggestedExpiryDate = profile?.defaultShelfLifeDays ? new Date(manufacturingDate.getTime() + profile.defaultShelfLifeDays * 86_400_000) : undefined;
  const qualityPending = profile?.requiresQualityCheck === "yes";
  const batch = await createProductBatch(organizationId, { productId: order.productId, warehouseId: order.finishedGoodsWarehouseId, lotNumber: input.lotNumber.trim(), receivedQuantity: input.goodQuantity, cost: unitCost, manufacturingDate, expiryDate: input.expiryDate ?? suggestedExpiryDate, status: qualityPending ? "quarantined" : "active", movementType: "production_output", sourceDocumentType: "production_order", sourceDocumentId: productionOrderId });
  const inserted = await db.transaction(async tx => {
    const output = await tx.insert(productionOutputs).values({ organizationId, productionOrderId, productId: order.productId, batchId: batch.id, goodQuantity: String(input.goodQuantity), defectiveQuantity: String(input.defectiveQuantity ?? 0), reworkQuantity: String(input.reworkQuantity ?? 0), scrapQuantity: String(input.scrapQuantity ?? 0), unitCost: String(unitCost), qualityStatus: qualityPending ? "pending" : "passed" });
    await tx.update(productionOrders).set({ status: qualityPending ? "quality_hold" : "completed", actualEnd: qualityPending ? undefined : new Date() }).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.output_recorded", entityType: "production_order", entityId: String(productionOrderId), metadata: { batchId: batch.id, goodQuantity: input.goodQuantity, materialCost, directCost, unitCost, qualityPending } });
    return Number(output[0].insertId);
  });
  return { outputId: inserted, batchId: batch.id, unitCost, qualityStatus: qualityPending ? "pending" as const : "passed" as const };
}

export async function recordProductionQualityCheck(organizationId: number, actorUserId: number, input: { productionOrderId: number; productionOutputId: number; checkType: string; result: "pass" | "fail"; numericValue?: number; notes?: string; checkedAt?: Date }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [output] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.id, input.productionOutputId), eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, input.productionOrderId))).limit(1);
  if (!output?.batchId) throw new Error("مخرج الإنتاج أو دفعة المنتج النهائي خارج نطاق المؤسسة.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, input.productionOrderId), eq(productionOrders.organizationId, organizationId))).limit(1);
  if (!order || !["quality_hold", "in_production"].includes(order.status)) throw new Error("لا يمكن تسجيل فحص جودة لأمر الإنتاج في حالته الحالية.");
  await db.transaction(async tx => {
    await tx.insert(productionQualityChecks).values({ organizationId, productionOrderId: input.productionOrderId, productionOutputId: input.productionOutputId, batchId: output.batchId!, checkType: input.checkType.trim(), result: input.result, numericValue: input.numericValue === undefined ? undefined : String(input.numericValue), notes: input.notes?.trim(), inspectorUserId: actorUserId, checkedAt: input.checkedAt ?? new Date() });
    await tx.update(productionOutputs).set({ qualityStatus: input.result === "pass" ? "passed" : "quarantined" }).where(and(eq(productionOutputs.id, input.productionOutputId), eq(productionOutputs.organizationId, organizationId)));
    await tx.update(productBatches).set({ status: input.result === "pass" ? "active" : "quarantined" }).where(and(eq(productBatches.id, output.batchId!), eq(productBatches.organizationId, organizationId)));
    await tx.update(productionOrders).set({ status: input.result === "pass" ? "completed" : "quality_hold", actualEnd: input.result === "pass" ? new Date() : undefined }).where(and(eq(productionOrders.id, input.productionOrderId), eq(productionOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.quality_checked", entityType: "production_output", entityId: String(input.productionOutputId), metadata: { productionOrderId: input.productionOrderId, batchId: output.batchId, result: input.result, checkType: input.checkType } });
  });
  return { productionOutputId: input.productionOutputId, batchId: output.batchId, result: input.result };
}

export async function recordProductionWaste(organizationId: number, actorUserId: number, input: { productionOrderId: number; productionOutputId: number; defectiveQuantity?: number; reworkQuantity?: number; scrapQuantity?: number; reason?: string }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const defectiveQuantity = input.defectiveQuantity ?? 0;
  const reworkQuantity = input.reworkQuantity ?? 0;
  const scrapQuantity = input.scrapQuantity ?? 0;
  if (![defectiveQuantity, reworkQuantity, scrapQuantity].every(value => Number.isFinite(value) && value >= 0) || defectiveQuantity + reworkQuantity + scrapQuantity <= 0) throw new Error("أدخل كمية موجبة واحدة على الأقل للهدر أو التالف أو إعادة التشغيل.");
  const [output] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.id, input.productionOutputId), eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, input.productionOrderId))).limit(1);
  if (!output) throw new Error("مخرج الإنتاج خارج نطاق أمر الإنتاج أو المؤسسة.");
  await db.transaction(async tx => {
    await tx.update(productionOutputs).set({ defectiveQuantity: sql`${productionOutputs.defectiveQuantity} + ${defectiveQuantity}`, reworkQuantity: sql`${productionOutputs.reworkQuantity} + ${reworkQuantity}`, scrapQuantity: sql`${productionOutputs.scrapQuantity} + ${scrapQuantity}` }).where(and(eq(productionOutputs.id, input.productionOutputId), eq(productionOutputs.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.waste_recorded", entityType: "production_output", entityId: String(input.productionOutputId), metadata: { productionOrderId: input.productionOrderId, defectiveQuantity, reworkQuantity, scrapQuantity, reason: input.reason?.trim() } });
  });
  return { productionOutputId: input.productionOutputId, defectiveQuantity, reworkQuantity, scrapQuantity };
}

export async function getProductionTraceability(organizationId: number, productionOrderId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId))).limit(1);
  if (!order) throw new Error("أمر الإنتاج خارج نطاق المؤسسة.");
  const [reservations, outputs] = await Promise.all([
    db.select().from(productionMaterialReservations).where(and(eq(productionMaterialReservations.organizationId, organizationId), eq(productionMaterialReservations.productionOrderId, productionOrderId))),
    db.select().from(productionOutputs).where(and(eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, productionOrderId))),
  ]);
  const rawBatchIds = reservations.flatMap(row => row.batchId ? [row.batchId] : []);
  const finishedBatchIds = outputs.flatMap(row => row.batchId ? [row.batchId] : []);
  const [rawBatches, finishedBatches] = await Promise.all([
    rawBatchIds.length ? db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), inArray(productBatches.id, rawBatchIds))) : Promise.resolve([]),
    finishedBatchIds.length ? db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), inArray(productBatches.id, finishedBatchIds))) : Promise.resolve([]),
  ]);
  return { order, rawMaterials: reservations.map(reservation => ({ reservation, batch: rawBatches.find(batch => batch.id === reservation.batchId) ?? null })), outputs: outputs.map(output => ({ output, batch: finishedBatches.find(batch => batch.id === output.batchId) ?? null })) };
}

export async function listProductionOrders(organizationId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(productionOrders).where(eq(productionOrders.organizationId, organizationId)).orderBy(desc(productionOrders.updatedAt), desc(productionOrders.id)).limit(100);
}

export async function getManufacturingOverview(organizationId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [orders, outputs, shortages, qualityHolds] = await Promise.all([
    db.select({ status: productionOrders.status, value: sql<string>`count(*)` }).from(productionOrders).where(eq(productionOrders.organizationId, organizationId)).groupBy(productionOrders.status),
    db.select({ goodQuantity: sql<string>`coalesce(sum(${productionOutputs.goodQuantity}), 0)`, wasteQuantity: sql<string>`coalesce(sum(${productionOutputs.scrapQuantity}) + sum(${productionOutputs.defectiveQuantity}), 0)`, averageUnitCost: sql<string>`coalesce(avg(${productionOutputs.unitCost}), 0)` }).from(productionOutputs).where(eq(productionOutputs.organizationId, organizationId)),
    db.select({ value: sql<string>`count(*)` }).from(productionMaterialReservations).where(and(eq(productionMaterialReservations.organizationId, organizationId), sql`${productionMaterialReservations.shortageQuantity} > 0`)),
    db.select({ value: sql<string>`count(*)` }).from(productionOrders).where(and(eq(productionOrders.organizationId, organizationId), eq(productionOrders.status, "quality_hold"))),
  ]);
  const countByStatus = Object.fromEntries(orders.map(row => [row.status, Number(row.value)]));
  return { planned: (countByStatus.planned ?? 0) + (countByStatus.approved ?? 0) + (countByStatus.materials_reserved ?? 0), inProduction: countByStatus.in_production ?? 0, completed: countByStatus.completed ?? 0, closed: countByStatus.closed ?? 0, materialShortages: Number(shortages[0]?.value ?? 0), qualityHold: Number(qualityHolds[0]?.value ?? 0), goodOutputQuantity: Number(outputs[0]?.goodQuantity ?? 0), wasteQuantity: Number(outputs[0]?.wasteQuantity ?? 0), averageUnitCost: Number(outputs[0]?.averageUnitCost ?? 0) };
}

export async function saveManufacturingProductProfile(organizationId: number, actorUserId: number, input: { productId: number; manufacturingType: "raw_material" | "packaging_material" | "semi_finished" | "finished_good" | "consumable" | "by_product"; requiresQualityCheck?: "yes" | "no"; defaultShelfLifeDays?: number }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.defaultShelfLifeDays !== undefined && (input.defaultShelfLifeDays < 0 || !Number.isInteger(input.defaultShelfLifeDays))) throw new Error("مدة الصلاحية الافتراضية يجب أن تكون عدداً صحيحاً غير سالب.");
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.organizationId, organizationId))).limit(1);
  if (!product) throw new Error("المنتج خارج نطاق المؤسسة.");
  await db.transaction(async tx => {
    await tx.insert(manufacturingProductProfiles).values({ organizationId, productId: input.productId, manufacturingType: input.manufacturingType, requiresQualityCheck: input.requiresQualityCheck ?? "no", defaultShelfLifeDays: input.defaultShelfLifeDays }).onDuplicateKeyUpdate({ set: { manufacturingType: input.manufacturingType, requiresQualityCheck: input.requiresQualityCheck ?? "no", defaultShelfLifeDays: input.defaultShelfLifeDays } });
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.product_profile_saved", entityType: "product", entityId: String(input.productId), metadata: input });
  });
  return { productId: input.productId };
}

export async function recordProductionExpense(organizationId: number, actorUserId: number, input: { productionOrderId: number; category: "labor" | "energy" | "cleaning" | "setup" | "other"; amount: number; currencyCode: string; notes?: string }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.amount <= 0) throw new Error("قيمة مصروف الإنتاج يجب أن تكون أكبر من صفر.");
  const [order, organization] = await Promise.all([
    db.select().from(productionOrders).where(and(eq(productionOrders.id, input.productionOrderId), eq(productionOrders.organizationId, organizationId))).limit(1).then(rows => rows[0]),
    db.select({ baseCurrency: organizations.baseCurrency }).from(organizations).where(eq(organizations.id, organizationId)).limit(1).then(rows => rows[0]),
  ]);
  if (!order || !organization || !["in_production", "quality_hold"].includes(order.status)) throw new Error("لا يمكن تسجيل مصروف لهذا الأمر في حالته الحالية.");
  const currencyCode = input.currencyCode.trim().toUpperCase();
  const [rate] = currencyCode === organization.baseCurrency ? [{ rate: "1" }] : await db.select({ rate: organizationExchangeRates.rate }).from(organizationExchangeRates).where(and(eq(organizationExchangeRates.organizationId, organizationId), eq(organizationExchangeRates.baseCurrencyCode, organization.baseCurrency), eq(organizationExchangeRates.quoteCurrencyCode, currencyCode), sql`${organizationExchangeRates.effectiveAt} <= now()`)).orderBy(desc(organizationExchangeRates.effectiveAt)).limit(1);
  if (!rate) throw new Error("لا يوجد سعر صرف تاريخي صالح لعملة مصروف الإنتاج.");
  const inserted = await db.transaction(async tx => {
    const expense = await tx.insert(productionExpenses).values({ organizationId, productionOrderId: input.productionOrderId, category: input.category, amount: String(input.amount), currencyCode, exchangeRateSnapshot: String(rate.rate), notes: input.notes?.trim(), createdByUserId: actorUserId });
    const expenseId = Number(expense[0].insertId);
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.expense_recorded", entityType: "production_expense", entityId: String(expenseId), metadata: { productionOrderId: input.productionOrderId, currencyCode, exchangeRateSnapshot: rate.rate } });
    return expenseId;
  });
  return { id: inserted, exchangeRateSnapshot: Number(rate.rate) };
}

export async function closeProductionOrder(organizationId: number, actorUserId: number, productionOrderId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId), eq(productionOrders.status, "completed"))).limit(1);
  const outputs = await db.select().from(productionOutputs).where(and(eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, productionOrderId), eq(productionOutputs.qualityStatus, "passed")));
  if (!order || !outputs.length) throw new Error("لا يمكن إقفال أمر لا يملك مخرجات معتمدة.");
  const totalGoodQuantity = outputs.reduce((total, row) => total + Number(row.goodQuantity), 0);
  const weightedCost = outputs.reduce((total, row) => total + Number(row.goodQuantity) * Number(row.unitCost ?? 0), 0);
  await db.transaction(async tx => {
    await tx.update(productionOrders).set({ status: "closed", actualEnd: order.actualEnd ?? new Date() }).where(and(eq(productionOrders.id, productionOrderId), eq(productionOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.order_closed", entityType: "production_order", entityId: String(productionOrderId), metadata: { totalGoodQuantity, totalActualCost: weightedCost, unitCost: totalGoodQuantity ? weightedCost / totalGoodQuantity : 0 } });
  });
  return { id: productionOrderId, status: "closed" as const, totalGoodQuantity, totalActualCost: weightedCost };
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
