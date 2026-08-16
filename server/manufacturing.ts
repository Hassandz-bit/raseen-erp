import { and, eq, inArray } from "drizzle-orm";
import { auditLogs, manufacturingBomItems, manufacturingBoms, productionMaterialReservations, productionOrders, productionStages, products, warehouses } from "../drizzle/schema";
import { getDb, previewFefoAllocation } from "./db";
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
    reservations.push({ organizationId, productionOrderId, bomItemId: item.id, productId: item.componentProductId, batchId: preview.allocations[0]?.batchId, requiredQuantity: String(required), availableQuantity: String(required - preview.remainingQuantity), reservedQuantity: String(required - preview.remainingQuantity), shortageQuantity: String(preview.remainingQuantity), overrideReason: preview.remainingQuantity > 0 ? overrideReason : undefined, overrideByUserId: preview.remainingQuantity > 0 && overrideReason ? actorUserId : undefined });
    if (preview.remainingQuantity > 0 && order.shortagePolicy === "block" && !overrideReason) throw new Error("يوجد نقص مواد، ولا تسمح سياسة الأمر بالتجاوز.");
  }
  await db.transaction(async tx => { await tx.insert(productionMaterialReservations).values(reservations); await tx.update(productionOrders).set({ status: "materials_reserved" }).where(eq(productionOrders.id, productionOrderId)); await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "manufacturing.materials_reserved", entityType: "production_order", entityId: String(productionOrderId), metadata: { overrideReason } }); });
  return { reservations };
}
