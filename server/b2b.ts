import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, b2bOrderAdjustments, b2bOrderReviews, b2bPromotions, b2bRetailerAccesses, b2bRetailerFavorites, b2bRetailerOrderItems, b2bRetailerOrders, b2bRetailerOutlets, b2bSavedOrderListItems, b2bSavedOrderLists, businessParties, distributionRouteStops, distributionRoutes, notifications, organizationModules, organizations, priceListItems, priceLists, productBatches, productPackagingLevels, products, salesInvoices, salesOrderItems, salesOrders } from "../drizzle/schema";
import { getDb } from "./db";
import { canUseRetailerPermission, isOutletAllowedForRetailer, type RetailerPermission, type RetailerRole } from "./retailerAccessPolicy";

type CatalogInput = { query?: string; categoryId?: number; brandId?: number; favoritesOnly?: boolean };
type OrderLine = { productId: number; quantity: number; unit?: string };
type RetailVisibilityPolicy = { showCatalog?: boolean; showPrices?: boolean; showPromotions?: boolean; showInvoices?: boolean; showDeliveryNotes?: boolean; showStatement?: boolean; stockVisibility?: "hidden" | "availability_only" | "level" | "exact"; debtVisibility?: "hidden" | "total_only" | "invoice_breakdown"; deliveryTracking?: "off" | "status_only" | "eta_only" | "limited_near_delivery"; allowRequestedDeliveryDate?: boolean; allowReturnRequest?: boolean; allowRetailerUserManagement?: boolean };
type RetailerAccessInput = { customerId: number; userId: number; retailerRole?: RetailerRole; outletIds?: number[]; priceListId?: number; customerSegment?: string; territoryId?: number; deliveryTrackingPolicy?: "off" | "status_only" | "eta_only" | "limited_live"; availabilityDisclosure?: "available" | "low" | "request"; visibilityPolicy?: RetailVisibilityPolicy; permissions?: Record<string, boolean> };

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const orderNumber = () => `B2B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const salesOrderNumber = () => `SO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const defaultVisibilityPolicy: Required<RetailVisibilityPolicy> = { showCatalog: true, showPrices: true, showPromotions: true, showInvoices: true, showDeliveryNotes: false, showStatement: false, stockVisibility: "availability_only", debtVisibility: "total_only", deliveryTracking: "status_only", allowRequestedDeliveryDate: true, allowReturnRequest: false, allowRetailerUserManagement: false };

export function exceedsRetailCreditLimit(creditLimit: number, outstandingBalance: number, proposedOrderTotal: number) {
  return creditLimit > 0 && roundMoney(outstandingBalance + proposedOrderTotal) > creditLimit;
}

export function resolveVisibilityPolicy(access: { visibilityPolicy: RetailVisibilityPolicy | null }) {
  return { ...defaultVisibilityPolicy, ...(access.visibilityPolicy ?? {}) };
}

async function assertRetailerOutletsBelongToCustomer(organizationId: number, customerId: number, outletIds: number[] | undefined) {
  const normalized = Array.from(new Set(outletIds ?? []));
  if (!normalized.length) return normalized;
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const outlets = await db.select({ id: b2bRetailerOutlets.id }).from(b2bRetailerOutlets).where(and(eq(b2bRetailerOutlets.organizationId, organizationId), eq(b2bRetailerOutlets.customerId, customerId), inArray(b2bRetailerOutlets.id, normalized)));
  if (outlets.length !== normalized.length) throw new Error("يتضمن نطاق منافذ مستخدم Retail منفذاً غير تابع للتاجر المحدد.");
  return normalized;
}

function assertRetailerPermission(access: { retailerRole: RetailerRole; permissions: Record<string, boolean> | null }, permission: RetailerPermission) {
  if (!canUseRetailerPermission(access.retailerRole, access.permissions, permission)) throw new Error("لا تملك صلاحية Retail المطلوبة لهذه العملية.");
}

function assertRetailerOutletScope(access: { retailerRole: RetailerRole; outletIds: number[] | null }, outletId: number | undefined) {
  if (!isOutletAllowedForRetailer(access.retailerRole, access.outletIds, outletId)) throw new Error("هذا المنفذ خارج نطاق مستخدم Retail الحالي.");
}

export async function grantRetailerAccess(organizationId: number, actorUserId: number, input: RetailerAccessInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [customer] = await db.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).limit(1);
  if (!customer || !customer.types.includes("customer")) throw new Error("يجب ربط وصول B2B بعميل نشط قائم داخل المؤسسة.");
  const outletIds = await assertRetailerOutletsBelongToCustomer(organizationId, input.customerId, input.outletIds);
  await db.insert(b2bRetailerAccesses).values({ organizationId, customerId: input.customerId, userId: input.userId, status: "active", retailerRole: input.retailerRole ?? "owner", outletIds, priceListId: input.priceListId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, deliveryTrackingPolicy: input.deliveryTrackingPolicy ?? "status_only", availabilityDisclosure: input.availabilityDisclosure ?? "available", visibilityPolicy: input.visibilityPolicy, permissions: input.permissions, grantedAt: new Date() }).onDuplicateKeyUpdate({ set: { status: "active", retailerRole: input.retailerRole ?? "owner", outletIds, priceListId: input.priceListId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, deliveryTrackingPolicy: input.deliveryTrackingPolicy ?? "status_only", availabilityDisclosure: input.availabilityDisclosure ?? "available", visibilityPolicy: input.visibilityPolicy, permissions: input.permissions, grantedAt: new Date(), revokedAt: null } });
  const [access] = await db.select().from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.organizationId, organizationId), eq(b2bRetailerAccesses.customerId, input.customerId), eq(b2bRetailerAccesses.userId, input.userId))).limit(1);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.access_granted", entityType: "b2b_retailer_access", entityId: String(access?.id ?? ""), metadata: { customerId: input.customerId, userId: input.userId } });
  return access;
}

export async function inviteRetailerAccess(organizationId: number, actorUserId: number, input: RetailerAccessInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [customer] = await db.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).limit(1);
  if (!customer || !customer.types.includes("customer")) throw new Error("يجب ربط دعوة Retail بعميل نشط قائم داخل المؤسسة.");
  const [existing] = await db.select({ id: b2bRetailerAccesses.id, status: b2bRetailerAccesses.status }).from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.organizationId, organizationId), eq(b2bRetailerAccesses.customerId, input.customerId), eq(b2bRetailerAccesses.userId, input.userId))).limit(1);
  if (existing?.status === "active") throw new Error("علاقة Retail نشطة بالفعل؛ لا يمكن إرسال دعوة جديدة قبل تعليقها أو إلغائها.");
  const now = new Date();
  const outletIds = await assertRetailerOutletsBelongToCustomer(organizationId, input.customerId, input.outletIds);
  await db.insert(b2bRetailerAccesses).values({ organizationId, customerId: input.customerId, userId: input.userId, status: "invited", retailerRole: input.retailerRole ?? "owner", outletIds, priceListId: input.priceListId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, deliveryTrackingPolicy: input.deliveryTrackingPolicy ?? "status_only", availabilityDisclosure: input.availabilityDisclosure ?? "available", visibilityPolicy: input.visibilityPolicy, permissions: input.permissions, invitedAt: now, lastInviteSentAt: now, revokedAt: null }).onDuplicateKeyUpdate({ set: { status: "invited", retailerRole: input.retailerRole ?? "owner", outletIds, priceListId: input.priceListId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, deliveryTrackingPolicy: input.deliveryTrackingPolicy ?? "status_only", availabilityDisclosure: input.availabilityDisclosure ?? "available", visibilityPolicy: input.visibilityPolicy, permissions: input.permissions, invitedAt: now, lastInviteSentAt: now, revokedAt: null } });
  const [access] = await db.select().from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.organizationId, organizationId), eq(b2bRetailerAccesses.customerId, input.customerId), eq(b2bRetailerAccesses.userId, input.userId))).limit(1);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.access_invited", entityType: "b2b_retailer_access", entityId: String(access?.id ?? ""), metadata: { customerId: input.customerId, userId: input.userId } });
  return access;
}

export async function resendRetailerAccessInvite(organizationId: number, actorUserId: number, accessId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [access] = await db.select().from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.organizationId, organizationId))).limit(1);
  if (!access || access.status !== "invited") throw new Error("لا يمكن إعادة إرسال دعوة لعلاقة Retail غير معلقة للدعوة.");
  const sentAt = new Date();
  await db.transaction(async tx => {
    await tx.update(b2bRetailerAccesses).set({ lastInviteSentAt: sentAt }).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.access_invite_resent", entityType: "b2b_retailer_access", entityId: String(accessId), metadata: { customerId: access.customerId, userId: access.userId } });
  });
  return { id: accessId, lastInviteSentAt: sentAt };
}

export async function updateRetailerAccessStatus(organizationId: number, actorUserId: number, accessId: number, status: "active" | "suspended" | "revoked") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [access] = await db.select().from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.organizationId, organizationId))).limit(1);
  if (!access) throw new Error("علاقة وصول B2B غير موجودة ضمن المؤسسة.");
  await db.transaction(async tx => {
    await tx.update(b2bRetailerAccesses).set({ status, revokedAt: status === "revoked" ? new Date() : null }).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: `b2b_retailer.access_${status}`, entityType: "b2b_retailer_access", entityId: String(accessId), metadata: { previousStatus: access.status } });
  });
  return { id: accessId, status };
}

export async function updateRetailerVisibilityPolicy(organizationId: number, actorUserId: number, accessId: number, visibilityPolicy: RetailVisibilityPolicy) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [access] = await db.select({ id: b2bRetailerAccesses.id }).from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.organizationId, organizationId))).limit(1);
  if (!access) throw new Error("علاقة Retail غير موجودة ضمن المؤسسة.");
  await db.transaction(async tx => {
    await tx.update(b2bRetailerAccesses).set({ visibilityPolicy }).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.visibility_updated", entityType: "b2b_retailer_access", entityId: String(accessId), metadata: { visibilityPolicy } });
  });
  return { id: accessId, visibilityPolicy };
}

export async function createB2bPromotion(organizationId: number, actorUserId: number, input: { name: string; type: "percentage_discount" | "fixed_discount" | "special_price" | "quantity_discount" | "buy_x_get_y"; productId: number; batchId?: number; customerId?: number; customerSegment?: string; territoryId?: number; minimumQuantity?: number; discountPercentage?: number; discountAmount?: number; specialPrice?: number; buyQuantity?: number; getQuantity?: number; startsAt: Date; endsAt: Date; visibleToB2b?: "yes" | "no" }) {
  if (input.endsAt <= input.startsAt) throw new Error("يجب أن ينتهي العرض بعد وقت بدايته.");
  if (input.type === "buy_x_get_y" && (!(input.buyQuantity && input.buyQuantity > 0) || !(input.getQuantity && input.getQuantity > 0))) throw new Error("يتطلب عرض Buy X Get Y كمية شراء وكمية مجانية موجبتين.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.organizationId, organizationId), eq(products.status, "active"))).limit(1);
  if (!product) throw new Error("لا يمكن نشر عرض B2B لمنتج غير نشط أو خارج المؤسسة.");
  const inserted = await db.insert(b2bPromotions).values({ organizationId, name: input.name.trim(), status: "active", type: input.type, productId: input.productId, batchId: input.batchId, customerId: input.customerId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, minimumQuantity: String(input.minimumQuantity ?? 1), discountPercentage: input.discountPercentage === undefined ? undefined : String(input.discountPercentage), discountAmount: input.discountAmount === undefined ? undefined : String(input.discountAmount), specialPrice: input.specialPrice === undefined ? undefined : String(input.specialPrice), buyQuantity: input.buyQuantity === undefined ? undefined : String(input.buyQuantity), getQuantity: input.getQuantity === undefined ? undefined : String(input.getQuantity), startsAt: input.startsAt, endsAt: input.endsAt, visibleToB2b: input.visibleToB2b ?? "yes", createdByUserId: actorUserId });
  const id = Number(inserted[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_promotion.created", entityType: "b2b_promotion", entityId: String(id), metadata: { type: input.type, productId: input.productId } });
  return { id, status: "active" as const };
}

export async function listRetailerAccesses(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({ id: b2bRetailerAccesses.id, organizationId: b2bRetailerAccesses.organizationId, organizationName: organizations.name, organizationCurrency: organizations.baseCurrency, customerId: b2bRetailerAccesses.customerId, customerName: businessParties.name, status: b2bRetailerAccesses.status, deliveryTrackingPolicy: b2bRetailerAccesses.deliveryTrackingPolicy }).from(b2bRetailerAccesses).innerJoin(organizations, eq(organizations.id, b2bRetailerAccesses.organizationId)).innerJoin(organizationModules, and(eq(organizationModules.organizationId, b2bRetailerAccesses.organizationId), eq(organizationModules.moduleKey, "nawa_retail"), eq(organizationModules.status, "active"))).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).where(and(eq(b2bRetailerAccesses.userId, userId), eq(b2bRetailerAccesses.status, "active"), eq(organizations.status, "active"), eq(businessParties.status, "active"))).orderBy(asc(organizations.name));
}

export async function listManagedRetailerAccesses(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({ id: b2bRetailerAccesses.id, userId: b2bRetailerAccesses.userId, customerId: b2bRetailerAccesses.customerId, customerName: businessParties.name, status: b2bRetailerAccesses.status, retailerRole: b2bRetailerAccesses.retailerRole, outletIds: b2bRetailerAccesses.outletIds, priceListId: b2bRetailerAccesses.priceListId, priceListName: priceLists.name, customerSegment: b2bRetailerAccesses.customerSegment, territoryId: b2bRetailerAccesses.territoryId, deliveryTrackingPolicy: b2bRetailerAccesses.deliveryTrackingPolicy, availabilityDisclosure: b2bRetailerAccesses.availabilityDisclosure, visibilityPolicy: b2bRetailerAccesses.visibilityPolicy, permissions: b2bRetailerAccesses.permissions, invitedAt: b2bRetailerAccesses.invitedAt, lastInviteSentAt: b2bRetailerAccesses.lastInviteSentAt, grantedAt: b2bRetailerAccesses.grantedAt, revokedAt: b2bRetailerAccesses.revokedAt }).from(b2bRetailerAccesses).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).leftJoin(priceLists, and(eq(priceLists.id, b2bRetailerAccesses.priceListId), eq(priceLists.organizationId, b2bRetailerAccesses.organizationId))).where(eq(b2bRetailerAccesses.organizationId, organizationId)).orderBy(asc(businessParties.name));
}

export async function listRetailerOutlets(organizationId: number, customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(b2bRetailerOutlets).where(and(eq(b2bRetailerOutlets.organizationId, organizationId), eq(b2bRetailerOutlets.customerId, customerId))).orderBy(asc(b2bRetailerOutlets.name));
}

export async function createRetailerOutlet(organizationId: number, actorUserId: number, input: { customerId: number; code: string; name: string; address?: string; wilaya?: string; commune?: string; deliveryInstructions?: string; latitude?: number; longitude?: number; territoryId?: number }) {
  if (!input.code.trim() || !input.name.trim()) throw new Error("رمز واسم منفذ التاجر مطلوبان.");
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;
  if (hasLatitude !== hasLongitude || (hasLatitude && (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude!) > 90 || Math.abs(input.longitude!) > 180))) throw new Error("إحداثيات منفذ التاجر غير صالحة.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [customer] = await db.select({ id: businessParties.id }).from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).limit(1);
  if (!customer) throw new Error("عميل التاجر غير موجود ضمن المؤسسة.");
  const inserted = await db.insert(b2bRetailerOutlets).values({ organizationId, customerId: input.customerId, code: input.code.trim(), name: input.name.trim(), address: input.address?.trim(), wilaya: input.wilaya?.trim(), commune: input.commune?.trim(), deliveryInstructions: input.deliveryInstructions?.trim(), latitude: hasLatitude ? String(input.latitude) : undefined, longitude: hasLongitude ? String(input.longitude) : undefined, territoryId: input.territoryId });
  const id = Number(inserted[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.outlet_created", entityType: "b2b_retailer_outlet", entityId: String(id), metadata: { customerId: input.customerId, hasLocation: hasLatitude } });
  return { id };
}

export async function requireRetailerAccess(userId: number, accessId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ access: b2bRetailerAccesses, organization: organizations, customer: businessParties }).from(b2bRetailerAccesses).innerJoin(organizations, eq(organizations.id, b2bRetailerAccesses.organizationId)).innerJoin(organizationModules, and(eq(organizationModules.organizationId, b2bRetailerAccesses.organizationId), eq(organizationModules.moduleKey, "nawa_retail"), eq(organizationModules.status, "active"))).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.userId, userId), eq(b2bRetailerAccesses.status, "active"), eq(organizations.status, "active"), eq(businessParties.status, "active"))).limit(1);
  if (!rows[0] || !rows[0].customer.types.includes("customer")) throw new Error("لا توجد علاقة وصول B2B نشطة لهذه المؤسسة.");
  return rows[0];
}

export async function listRetailerOutletsForAccess(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.outlets.view");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const outlets = await db.select().from(b2bRetailerOutlets).where(and(eq(b2bRetailerOutlets.organizationId, access.access.organizationId), eq(b2bRetailerOutlets.customerId, access.customer.id), eq(b2bRetailerOutlets.status, "active"))).orderBy(asc(b2bRetailerOutlets.name));
  return outlets.filter(outlet => isOutletAllowedForRetailer(access.access.retailerRole, access.access.outletIds, outlet.id));
}

async function resolveRetailerProduct(access: Awaited<ReturnType<typeof requireRetailerAccess>>, productId: number, requestedUnit?: string, quantity = 1) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.organizationId, access.access.organizationId), eq(products.status, "active"))).limit(1);
  if (!product) throw new Error("المنتج غير متاح للمؤسسة المحددة.");
  const unit = requestedUnit?.trim() || product.salesUnit;
  const items = await db.select({ id: priceListItems.id, price: priceListItems.price, unit: priceListItems.unit, minimumQuantity: priceListItems.minimumQuantity, listId: priceLists.id, listKind: priceLists.kind, listPriority: priceLists.priority, currencyCode: priceLists.currencyCode }).from(priceListItems).innerJoin(priceLists, and(eq(priceLists.id, priceListItems.priceListId), eq(priceLists.organizationId, priceListItems.organizationId))).where(and(eq(priceListItems.organizationId, access.access.organizationId), eq(priceListItems.productId, productId), eq(priceLists.status, "active"))).orderBy(asc(priceLists.priority));
  const assignedIds = [access.access.priceListId, access.customer.priceListId].filter((value): value is number => Boolean(value));
  const matchingItem = items.find(item => item.unit === unit && assignedIds.includes(item.listId)) ?? items.find(item => item.unit === unit && item.listKind === "default") ?? items.find(item => item.unit === unit) ?? items.find(item => !item.unit && assignedIds.includes(item.listId)) ?? items.find(item => !item.unit && item.listKind === "default") ?? items.find(item => !item.unit);
  const stockRows = await db.select({ quantity: sql<string>`coalesce(sum(${productBatches.currentQuantity} - ${productBatches.reservedQuantity}), 0)` }).from(productBatches).where(and(eq(productBatches.organizationId, access.access.organizationId), eq(productBatches.productId, productId), eq(productBatches.status, "active"), sql`(${productBatches.expiryDate} IS NULL OR ${productBatches.expiryDate} > now())`));
  const available = Number(stockRows[0]?.quantity ?? 0);
  const disclosure = access.access.availabilityDisclosure;
  const availability = disclosure === "request" ? "on_request" : available <= 0 ? "out_of_stock" : disclosure === "low" ? "low_availability" : "available";
  const basePrice = Number(matchingItem?.price ?? product.salePrice);
  const now = new Date();
  const promotions = await db.select().from(b2bPromotions).where(and(eq(b2bPromotions.organizationId, access.access.organizationId), eq(b2bPromotions.productId, productId), eq(b2bPromotions.status, "active"), eq(b2bPromotions.visibleToB2b, "yes"), sql`${b2bPromotions.startsAt} <= ${now}`, sql`${b2bPromotions.endsAt} >= ${now}`));
  const batchIds = promotions.flatMap(item => item.batchId ? [item.batchId] : []);
  const promotionBatches = batchIds.length ? await db.select({ id: productBatches.id, expiryDate: productBatches.expiryDate, currentQuantity: productBatches.currentQuantity, reservedQuantity: productBatches.reservedQuantity, status: productBatches.status }).from(productBatches).where(and(eq(productBatches.organizationId, access.access.organizationId), eq(productBatches.productId, productId), inArray(productBatches.id, batchIds))) : [];
  const promotion = promotions.filter(item => (!item.customerId || item.customerId === access.customer.id) && (!item.customerSegment || item.customerSegment === access.access.customerSegment) && (!item.territoryId || item.territoryId === access.access.territoryId) && Number(item.minimumQuantity) <= quantity && (!item.batchId || promotionBatches.some(batch => batch.id === item.batchId && batch.status === "active" && Number(batch.currentQuantity) > Number(batch.reservedQuantity) && (!batch.expiryDate || batch.expiryDate > now)))).sort((a, b) => Number(b.minimumQuantity) - Number(a.minimumQuantity))[0];
  let unitPrice = basePrice;
  let paidQuantity = quantity;
  let freeQuantity = 0;
  if (promotion) {
    if (promotion.type === "percentage_discount") unitPrice = roundMoney(basePrice * (1 - Number(promotion.discountPercentage ?? 0) / 100));
    if (promotion.type === "fixed_discount" || promotion.type === "quantity_discount") unitPrice = Math.max(0, roundMoney(basePrice - Number(promotion.discountAmount ?? 0)));
    if (promotion.type === "special_price") unitPrice = Number(promotion.specialPrice ?? basePrice);
    if (promotion.type === "buy_x_get_y") { const group = Number(promotion.buyQuantity ?? 0) + Number(promotion.getQuantity ?? 0); if (group > 0) { freeQuantity = Math.floor(quantity / group) * Number(promotion.getQuantity ?? 0); paidQuantity = quantity - freeQuantity; } }
  }
  return { product, unit, unitPrice, paidQuantity, freeQuantity, promotionId: promotion?.id, promotionLabel: promotion?.name, taxRate: Number(product.taxRate), currencyCode: matchingItem?.currencyCode ?? access.organization.baseCurrency, pricingSource: promotion ? `promotion_${promotion.id}` : matchingItem ? `price_list_${matchingItem.listId}` : "default_product_price", availability };
}

export async function getRetailerCatalog(userId: number, accessId: number, input: CatalogInput = {}) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.catalog.view");
  const visibility = resolveVisibilityPolicy(access.access);
  if (!visibility.showCatalog) return [];
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const clauses = [eq(products.organizationId, access.access.organizationId), eq(products.status, "active")];
  if (input.favoritesOnly) {
    const favorites = await db.select({ productId: b2bRetailerFavorites.productId }).from(b2bRetailerFavorites).where(and(eq(b2bRetailerFavorites.organizationId, access.access.organizationId), eq(b2bRetailerFavorites.accessId, access.access.id)));
    if (!favorites.length) return [];
    clauses.push(inArray(products.id, favorites.map(item => item.productId)));
  }
  if (input.categoryId) clauses.push(eq(products.categoryId, input.categoryId));
  if (input.brandId) clauses.push(eq(products.brandId, input.brandId));
  if (input.query?.trim()) clauses.push(sql`(${products.name} like ${`%${input.query.trim()}%`} or ${products.sku} like ${`%${input.query.trim()}%`})`);
  const rows = await db.select().from(products).where(and(...clauses)).orderBy(asc(products.name)).limit(200);
  return Promise.all(rows.map(async product => {
    const resolved = await resolveRetailerProduct(access, product.id);
    const packagingLevels = await db.select({ id: productPackagingLevels.id, code: productPackagingLevels.code, displayName: productPackagingLevels.displayName, factorToBase: productPackagingLevels.factorToBase, barcode: productPackagingLevels.barcode, isDefault: productPackagingLevels.isDefaultB2b }).from(productPackagingLevels).where(and(eq(productPackagingLevels.organizationId, access.access.organizationId), eq(productPackagingLevels.productId, product.id), eq(productPackagingLevels.allowedB2b, "yes"), eq(productPackagingLevels.status, "active"))).orderBy(asc(productPackagingLevels.factorToBase));
    return { id: product.id, name: product.name, nameAr: product.nameAr, nameFr: product.nameFr, nameEn: product.nameEn, sku: product.sku, imageUrl: product.imageUrl, categoryId: product.categoryId, brandId: product.brandId, salesUnit: product.salesUnit, unitsPerCarton: product.unitsPerCarton, unitPrice: visibility.showPrices ? resolved.unitPrice : null, currencyCode: resolved.currencyCode, pricingSource: visibility.showPrices ? resolved.pricingSource : undefined, promotionLabel: visibility.showPromotions ? resolved.promotionLabel : undefined, availability: visibility.stockVisibility === "hidden" ? undefined : resolved.availability, packagingLevels };
  }));
}

export async function toggleRetailerFavorite(userId: number, accessId: number, productId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.catalog.view");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.organizationId, access.access.organizationId), eq(products.status, "active"))).limit(1);
  if (!product) throw new Error("المنتج غير متاح للمؤسسة المحددة.");
  const [existing] = await db.select({ id: b2bRetailerFavorites.id }).from(b2bRetailerFavorites).where(and(eq(b2bRetailerFavorites.organizationId, access.access.organizationId), eq(b2bRetailerFavorites.accessId, access.access.id), eq(b2bRetailerFavorites.productId, productId))).limit(1);
  if (existing) {
    await db.delete(b2bRetailerFavorites).where(eq(b2bRetailerFavorites.id, existing.id));
    return { productId, favorite: false };
  }
  await db.insert(b2bRetailerFavorites).values({ organizationId: access.access.organizationId, accessId: access.access.id, productId });
  return { productId, favorite: true };
}

export async function listRetailerFavorites(userId: number, accessId: number) {
  return getRetailerCatalog(userId, accessId, { favoritesOnly: true });
}

export async function getRetailerFrequentProducts(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.view");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ productId: b2bRetailerOrderItems.productId, quantity: b2bRetailerOrderItems.quantity }).from(b2bRetailerOrderItems).innerJoin(b2bRetailerOrders, and(eq(b2bRetailerOrders.id, b2bRetailerOrderItems.orderId), eq(b2bRetailerOrders.organizationId, b2bRetailerOrderItems.organizationId))).where(and(eq(b2bRetailerOrderItems.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).limit(1000);
  const quantities = new Map<number, number>();
  rows.forEach(row => quantities.set(row.productId, (quantities.get(row.productId) ?? 0) + Number(row.quantity)));
  const rankedIds = Array.from(quantities.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([productId]) => productId);
  if (!rankedIds.length) return [];
  const catalog = await getRetailerCatalog(userId, accessId);
  const catalogById = new Map(catalog.map(item => [item.id, item]));
  return rankedIds.flatMap(productId => {
    const product = catalogById.get(productId);
    return product ? [{ ...product, orderedQuantity: quantities.get(productId) ?? 0 }] : [];
  });
}

export async function getRetailerSummary(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.view");
  const visibility = resolveVisibilityPolicy(access.access);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [orders, invoices, promotions] = await Promise.all([
    db.select({ status: b2bRetailerOrders.status }).from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).limit(200),
    db.select({ grandTotal: salesInvoices.grandTotal, amountPaid: salesInvoices.amountPaid }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, access.access.organizationId), eq(salesInvoices.customerId, access.customer.id))).limit(200),
    db.select({ id: b2bPromotions.id, customerId: b2bPromotions.customerId, customerSegment: b2bPromotions.customerSegment, territoryId: b2bPromotions.territoryId }).from(b2bPromotions).where(and(eq(b2bPromotions.organizationId, access.access.organizationId), eq(b2bPromotions.status, "active"), eq(b2bPromotions.visibleToB2b, "yes"), sql`${b2bPromotions.startsAt} <= ${new Date()}`, sql`${b2bPromotions.endsAt} >= ${new Date()}`)).limit(200),
  ]);
  const activeStatuses = new Set(["new", "review", "confirmed", "preparing", "ready", "loaded", "in_transit", "arrived", "partial"]);
  const canViewDebt = visibility.debtVisibility !== "hidden" && canUseRetailerPermission(access.access.retailerRole, access.access.permissions, "retail.debt.view");
  return { activeOrders: orders.filter(order => activeStatuses.has(order.status)).length, outstandingBalance: canViewDebt ? roundMoney(invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid)), 0)) : null, currencyCode: access.organization.baseCurrency, activePromotions: visibility.showPromotions ? promotions.filter(promotion => (!promotion.customerId || promotion.customerId === access.customer.id) && (!promotion.customerSegment || promotion.customerSegment === access.access.customerSegment) && (!promotion.territoryId || promotion.territoryId === access.access.territoryId)).length : 0 };
}

export async function listRetailerPromotions(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.promotions.view");
  if (!resolveVisibilityPolicy(access.access).showPromotions) return [];
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const now = new Date();
  const rows = await db.select({ id: b2bPromotions.id, name: b2bPromotions.name, type: b2bPromotions.type, productId: b2bPromotions.productId, productName: products.name, productNameAr: products.nameAr, productNameFr: products.nameFr, productNameEn: products.nameEn, minimumQuantity: b2bPromotions.minimumQuantity, endsAt: b2bPromotions.endsAt, customerId: b2bPromotions.customerId, customerSegment: b2bPromotions.customerSegment, territoryId: b2bPromotions.territoryId }).from(b2bPromotions).innerJoin(products, and(eq(products.id, b2bPromotions.productId), eq(products.organizationId, b2bPromotions.organizationId), eq(products.status, "active"))).where(and(eq(b2bPromotions.organizationId, access.access.organizationId), eq(b2bPromotions.status, "active"), eq(b2bPromotions.visibleToB2b, "yes"), sql`${b2bPromotions.startsAt} <= ${now}`, sql`${b2bPromotions.endsAt} >= ${now}`)).orderBy(asc(b2bPromotions.endsAt)).limit(50);
  const nearEndThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return rows.filter(promotion => (!promotion.customerId || promotion.customerId === access.customer.id) && (!promotion.customerSegment || promotion.customerSegment === access.access.customerSegment) && (!promotion.territoryId || promotion.territoryId === access.access.territoryId)).map(({ customerId: _customerId, customerSegment: _customerSegment, territoryId: _territoryId, ...promotion }) => ({ ...promotion, isNearEnd: promotion.endsAt <= nearEndThreshold }));
}

export async function getRetailerMonthlyReport(userId: number, accessId: number, month: number, year: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.view");
  const visibility = resolveVisibilityPolicy(access.access);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const startsAt = new Date(Date.UTC(year, month - 1, 1));
  const endsAt = new Date(Date.UTC(year, month, 1));
  const [orders, invoiceRows] = await Promise.all([
    db.select({ id: b2bRetailerOrders.id, orderNumber: b2bRetailerOrders.orderNumber, status: b2bRetailerOrders.status, paymentStatus: b2bRetailerOrders.paymentStatus, currencyCode: b2bRetailerOrders.currencyCode, totalAmount: b2bRetailerOrders.totalAmount, createdAt: b2bRetailerOrders.createdAt }).from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id), sql`${b2bRetailerOrders.createdAt} >= ${startsAt}`, sql`${b2bRetailerOrders.createdAt} < ${endsAt}`)).orderBy(desc(b2bRetailerOrders.createdAt)).limit(500),
    db.select({ id: salesInvoices.id, invoiceNumber: salesInvoices.invoiceNumber, status: salesInvoices.status, currencyCode: salesInvoices.currencyCode, grandTotal: salesInvoices.grandTotal, amountPaid: salesInvoices.amountPaid, issuedAt: salesInvoices.issuedAt }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, access.access.organizationId), eq(salesInvoices.customerId, access.customer.id), sql`${salesInvoices.issuedAt} >= ${startsAt}`, sql`${salesInvoices.issuedAt} < ${endsAt}`)).orderBy(desc(salesInvoices.issuedAt)).limit(500),
  ]);
  const canViewInvoices = visibility.showInvoices && canUseRetailerPermission(access.access.retailerRole, access.access.permissions, "retail.invoices.view");
  const invoices = canViewInvoices ? invoiceRows : [];
  const orderTotal = roundMoney(orders.reduce((sum, order) => sum + Number(order.totalAmount), 0));
  const invoicedTotal = roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0));
  const canViewDebt = visibility.debtVisibility !== "hidden" && canUseRetailerPermission(access.access.retailerRole, access.access.permissions, "retail.debt.view");
  const outstandingBalance = canViewDebt ? roundMoney(invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid)), 0)) : null;
  return { period: { month, year, startsAt, endsAt }, currencyCode: access.organization.baseCurrency, summary: { orderCount: orders.length, orderTotal, invoiceCount: invoices.length, invoicedTotal, outstandingBalance }, orders, invoices };
}

export async function listRetailerOrders(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.view");
  const visibility = resolveVisibilityPolicy(access.access);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ order: b2bRetailerOrders, salesOrder: salesOrders, routeStatus: distributionRoutes.status, stopStatus: distributionRouteStops.deliveryStatus }).from(b2bRetailerOrders).leftJoin(salesOrders, and(eq(salesOrders.b2bOrderId, b2bRetailerOrders.id), eq(salesOrders.organizationId, b2bRetailerOrders.organizationId))).leftJoin(distributionRouteStops, and(eq(distributionRouteStops.salesOrderReference, salesOrders.orderNumber), eq(distributionRouteStops.organizationId, b2bRetailerOrders.organizationId))).leftJoin(distributionRoutes, and(eq(distributionRoutes.id, distributionRouteStops.routeId), eq(distributionRoutes.organizationId, b2bRetailerOrders.organizationId))).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).orderBy(desc(b2bRetailerOrders.createdAt)).limit(100);
  const ids = rows.map(row => row.order.id);
  const reviews = ids.length ? await db.select().from(b2bOrderReviews).where(and(eq(b2bOrderReviews.organizationId, access.access.organizationId), inArray(b2bOrderReviews.b2bOrderId, ids))).orderBy(asc(b2bOrderReviews.reviewedAt)) : [];
  return rows.map(({ order, salesOrder, routeStatus, stopStatus }) => {
    const timeline = [{ key: "submitted", at: order.createdAt }];
    for (const review of reviews.filter(item => item.b2bOrderId === order.id)) timeline.push({ key: review.status, at: review.reviewedAt });
    if (visibility.deliveryTracking !== "off") {
      if (salesOrder?.status === "preparing") timeline.push({ key: "preparing", at: salesOrder.updatedAt });
      if (salesOrder?.status === "ready") timeline.push({ key: "ready", at: salesOrder.updatedAt });
      if (salesOrder?.status === "loaded") timeline.push({ key: "loaded", at: salesOrder.updatedAt });
      if (routeStatus === "started" || routeStatus === "in_progress") timeline.push({ key: "in_transit", at: salesOrder?.updatedAt ?? order.createdAt });
      if (stopStatus === "delivered" || stopStatus === "partial") timeline.push({ key: stopStatus, at: salesOrder?.updatedAt ?? order.createdAt });
    }
    const displayStatus = visibility.deliveryTracking === "off" ? order.status : stopStatus === "delivered" ? "delivered" : stopStatus === "partial" ? "partial" : routeStatus === "started" || routeStatus === "in_progress" ? "in_transit" : salesOrder?.status ?? order.status;
    return { ...order, salesOrderId: salesOrder?.id, salesOrderNumber: salesOrder?.orderNumber, confirmedTotal: salesOrder?.totalAmount, displayStatus, timeline, deliveryTrackingPolicy: visibility.deliveryTracking };
  });
}

export async function listOrganizationB2bOrders(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ order: b2bRetailerOrders, retailerName: businessParties.name, accessStatus: b2bRetailerAccesses.status }).from(b2bRetailerOrders).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerOrders.customerId), eq(businessParties.organizationId, b2bRetailerOrders.organizationId))).innerJoin(b2bRetailerAccesses, and(eq(b2bRetailerAccesses.id, b2bRetailerOrders.accessId), eq(b2bRetailerAccesses.organizationId, b2bRetailerOrders.organizationId))).where(eq(b2bRetailerOrders.organizationId, organizationId)).orderBy(desc(b2bRetailerOrders.createdAt)).limit(200);
  const ids = rows.map(row => row.order.id);
  const itemRows = ids.length ? await db.select().from(b2bRetailerOrderItems).where(and(eq(b2bRetailerOrderItems.organizationId, organizationId), inArray(b2bRetailerOrderItems.orderId, ids))) : [];
  return rows.map(row => ({ ...row.order, retailerName: row.retailerName, accessStatus: row.accessStatus, items: itemRows.filter(item => item.orderId === row.order.id) }));
}

export async function createRetailerOrder(userId: number, accessId: number, input: { lines: OrderLine[]; outletId?: number; clientOperationId: string; notes?: string; requestedDeliveryDate?: Date }) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.create");
  if (input.requestedDeliveryDate && !resolveVisibilityPolicy(access.access).allowRequestedDeliveryDate) throw new Error("لا تسمح سياسة المورد باختيار تاريخ تسليم مطلوب.");
  if (!input.clientOperationId.trim() || input.clientOperationId.length > 128) throw new Error("معرف عملية الطلب غير صالح.");
  if (!input.lines.length || input.lines.length > 100) throw new Error("يجب أن يحتوي الطلب على بند واحد على الأقل وبحد أقصى 100 بند.");
  const normalized = [] as Array<{ productId: number; unit: string; quantity: number; paidQuantity: number; freeQuantity: number; promotionId?: number; promotionLabel?: string; unitPrice: number; taxRate: number; lineTotal: number; pricingSource: string; currencyCode: string }>;
  for (const line of input.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("كمية أحد بنود الطلب غير صالحة.");
    const resolved = await resolveRetailerProduct(access, line.productId, line.unit, line.quantity);
    if (resolved.availability === "out_of_stock") throw new Error("أحد منتجات الطلب غير متاح حالياً.");
    const beforeTax = roundMoney(resolved.paidQuantity * resolved.unitPrice);
    const tax = roundMoney(beforeTax * (resolved.taxRate / 100));
    normalized.push({ productId: line.productId, unit: resolved.unit, quantity: line.quantity, paidQuantity: resolved.paidQuantity, freeQuantity: resolved.freeQuantity, promotionId: resolved.promotionId, promotionLabel: resolved.promotionLabel, unitPrice: resolved.unitPrice, taxRate: resolved.taxRate, lineTotal: roundMoney(beforeTax + tax), pricingSource: resolved.pricingSource, currencyCode: resolved.currencyCode });
  }
  const currencyCode = normalized[0]!.currencyCode;
  if (normalized.some(line => line.currencyCode !== currencyCode)) throw new Error("لا يمكن خلط عملات متعددة في طلب B2B واحد.");
  const subtotal = roundMoney(normalized.reduce((sum, line) => sum + line.paidQuantity * line.unitPrice, 0));
  const taxAmount = roundMoney(normalized.reduce((sum, line) => sum + (line.lineTotal - line.paidQuantity * line.unitPrice), 0));
  const totalAmount = roundMoney(subtotal + taxAmount);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const creditLimit = Number(access.customer.creditLimit);
  if (creditLimit > 0) {
    const invoices = await db.select({ grandTotal: salesInvoices.grandTotal, amountPaid: salesInvoices.amountPaid }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, access.access.organizationId), eq(salesInvoices.customerId, access.customer.id))).limit(500);
    const outstanding = roundMoney(invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid)), 0));
    if (exceedsRetailCreditLimit(creditLimit, outstanding, totalAmount)) throw new Error("يتجاوز الطلب الرصيد الائتماني المتاح للمحل.");
  }
  const outlets = await db.select().from(b2bRetailerOutlets).where(and(eq(b2bRetailerOutlets.organizationId, access.access.organizationId), eq(b2bRetailerOutlets.customerId, access.customer.id), eq(b2bRetailerOutlets.status, "active"))).orderBy(asc(b2bRetailerOutlets.name));
  const outletId = input.outletId ?? (outlets.length === 1 ? outlets[0]?.id : undefined);
  if (outlets.length > 1 && !outletId) throw new Error("يجب اختيار منفذ التسليم عند وجود أكثر من منفذ نشط.");
  const outlet = outletId ? outlets.find(item => item.id === outletId) : undefined;
  if (outletId && !outlet) throw new Error("منفذ التسليم غير نشط أو لا يتبع التاجر الحالي.");
  assertRetailerOutletScope(access.access, outletId);
  return db.transaction(async tx => {
    const [existing] = await tx.select({ id: b2bRetailerOrders.id, totalAmount: b2bRetailerOrders.totalAmount, currencyCode: b2bRetailerOrders.currencyCode, status: b2bRetailerOrders.status }).from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.clientOperationId, input.clientOperationId.trim()))).limit(1);
    if (existing) return { id: existing.id, totalAmount: Number(existing.totalAmount), currencyCode: existing.currencyCode, status: existing.status, idempotentReplay: true };
    const inserted = await tx.insert(b2bRetailerOrders).values({ organizationId: access.access.organizationId, accessId: access.access.id, customerId: access.customer.id, outletId, clientOperationId: input.clientOperationId.trim(), orderNumber: orderNumber(), currencyCode, subtotal: String(subtotal), taxAmount: String(taxAmount), totalAmount: String(totalAmount), requestedDeliveryDate: input.requestedDeliveryDate, notes: input.notes?.trim(), createdByUserId: userId });
    const orderId = Number(inserted[0].insertId);
    await tx.insert(b2bRetailerOrderItems).values(normalized.map(line => ({ organizationId: access.access.organizationId, orderId, productId: line.productId, unit: line.unit, quantity: String(line.quantity), paidQuantity: String(line.paidQuantity), freeQuantity: String(line.freeQuantity), promotionId: line.promotionId, unitPrice: String(line.unitPrice), taxRate: String(line.taxRate), lineTotal: String(line.lineTotal), pricingSource: line.pricingSource, promotionLabel: line.promotionLabel })));
    await tx.insert(auditLogs).values({ organizationId: access.access.organizationId, actorUserId: userId, action: "b2b_order.submitted", entityType: "b2b_order", entityId: String(orderId), metadata: { accessId: access.access.id, customerId: access.customer.id, outletId, clientOperationId: input.clientOperationId.trim() } });
    await tx.insert(notifications).values({ organizationId: access.access.organizationId, targetUserId: userId, targetRetailerAccessId: access.access.id, type: "retail_order_submitted", severity: "info", title: "تم إرسال طلب Retail", content: `تم إرسال طلبك ${orderNumber} للمراجعة.`, isRead: "no" });
    return { id: orderId, totalAmount, currencyCode, status: "new" as const, idempotentReplay: false };
  });
}

export async function reorderRetailerOrder(userId: number, accessId: number, orderId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.create");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.id, orderId), eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).limit(1);
  if (!order) throw new Error("الطلب السابق غير متاح لإعادة الطلب.");
  const items = await db.select().from(b2bRetailerOrderItems).where(and(eq(b2bRetailerOrderItems.organizationId, access.access.organizationId), eq(b2bRetailerOrderItems.orderId, orderId)));
  return createRetailerOrder(userId, accessId, { lines: items.map(item => ({ productId: item.productId, quantity: Number(item.quantity), unit: item.unit })), outletId: order.outletId ?? undefined, clientOperationId: `reorder-${orderId}-${Date.now()}`, notes: `إعادة طلب من ${order.orderNumber}` });
}

export async function createSavedRetailerOrderList(userId: number, accessId: number, input: { name: string; lines: OrderLine[] }) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.create");
  const name = input.name.trim();
  if (!name || name.length > 160 || !input.lines.length || input.lines.length > 100) throw new Error("اسم قائمة الطلب وبنودها غير صالحين.");
  const normalized: OrderLine[] = [];
  for (const line of input.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("كمية بند القائمة المحفوظة غير صالحة.");
    const resolved = await resolveRetailerProduct(access, line.productId, line.unit, line.quantity);
    normalized.push({ productId: line.productId, quantity: line.quantity, unit: resolved.unit });
  }
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const inserted = await tx.insert(b2bSavedOrderLists).values({ organizationId: access.access.organizationId, accessId: access.access.id, customerId: access.customer.id, name, createdByUserId: userId });
    const listId = Number(inserted[0].insertId);
    await tx.insert(b2bSavedOrderListItems).values(normalized.map(line => ({ organizationId: access.access.organizationId, listId, productId: line.productId, unit: line.unit ?? "", quantity: String(line.quantity) })));
    await tx.insert(auditLogs).values({ organizationId: access.access.organizationId, actorUserId: userId, action: "b2b_saved_list.created", entityType: "b2b_saved_order_list", entityId: String(listId), metadata: { accessId: access.access.id, itemCount: normalized.length } });
    return { id: listId, name, itemCount: normalized.length };
  });
}

export async function listSavedRetailerOrderLists(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.view");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const lists = await db.select().from(b2bSavedOrderLists).where(and(eq(b2bSavedOrderLists.organizationId, access.access.organizationId), eq(b2bSavedOrderLists.accessId, access.access.id), eq(b2bSavedOrderLists.customerId, access.customer.id))).orderBy(desc(b2bSavedOrderLists.updatedAt)).limit(100);
  if (!lists.length) return [];
  const items = await db.select().from(b2bSavedOrderListItems).where(and(eq(b2bSavedOrderListItems.organizationId, access.access.organizationId), inArray(b2bSavedOrderListItems.listId, lists.map(list => list.id))));
  return lists.map(list => ({ ...list, items: items.filter(item => item.listId === list.id) }));
}

export async function submitSavedRetailerOrderList(userId: number, accessId: number, input: { listId: number; outletId?: number; clientOperationId: string; notes?: string; requestedDeliveryDate?: Date }) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.create");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [list] = await db.select().from(b2bSavedOrderLists).where(and(eq(b2bSavedOrderLists.id, input.listId), eq(b2bSavedOrderLists.organizationId, access.access.organizationId), eq(b2bSavedOrderLists.accessId, access.access.id), eq(b2bSavedOrderLists.customerId, access.customer.id))).limit(1);
  if (!list) throw new Error("قائمة الطلب المحفوظة غير متاحة.");
  const items = await db.select().from(b2bSavedOrderListItems).where(and(eq(b2bSavedOrderListItems.organizationId, access.access.organizationId), eq(b2bSavedOrderListItems.listId, list.id)));
  if (!items.length) throw new Error("قائمة الطلب المحفوظة لا تحتوي بنوداً.");
  return createRetailerOrder(userId, accessId, { lines: items.map(item => ({ productId: item.productId, quantity: Number(item.quantity), unit: item.unit })), outletId: input.outletId, clientOperationId: input.clientOperationId, requestedDeliveryDate: input.requestedDeliveryDate, notes: input.notes?.trim() || `طلب من القائمة: ${list.name}` });
}

export async function listRetailerDocuments(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.invoices.view");
  if (!resolveVisibilityPolicy(access.access).showInvoices) return [];
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({ id: salesInvoices.id, invoiceNumber: salesInvoices.invoiceNumber, status: salesInvoices.status, currencyCode: salesInvoices.currencyCode, grandTotal: salesInvoices.grandTotal, amountPaid: salesInvoices.amountPaid, dueDate: salesInvoices.dueDate, issuedAt: salesInvoices.issuedAt }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, access.access.organizationId), eq(salesInvoices.customerId, access.customer.id))).orderBy(desc(salesInvoices.createdAt)).limit(100);
}

export async function reviewAndConvertRetailerOrder(organizationId: number, actorUserId: number, input: { orderId: number; action: "approve" | "reject"; reason?: string; confirmedDeliveryDate?: Date; lines?: Array<{ orderItemId: number; quantity: number; unitPrice?: number; reason?: string }> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const [order] = await tx.select().from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.id, input.orderId), eq(b2bRetailerOrders.organizationId, organizationId))).limit(1);
    if (!order) throw new Error("طلب B2B غير موجود ضمن المؤسسة.");
    const [retailerAccess] = await tx.select({ userId: b2bRetailerAccesses.userId }).from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.id, order.accessId), eq(b2bRetailerAccesses.organizationId, organizationId), eq(b2bRetailerAccesses.customerId, order.customerId))).limit(1);
    if (!retailerAccess) throw new Error("علاقة Retail الخاصة بالطلب لم تعد صالحة ضمن المؤسسة.");
    if (order.status === "cancelled") throw new Error("لا يمكن مراجعة طلب ملغى.");
    const [outlet] = order.outletId ? await tx.select().from(b2bRetailerOutlets).where(and(eq(b2bRetailerOutlets.id, order.outletId), eq(b2bRetailerOutlets.organizationId, organizationId), eq(b2bRetailerOutlets.customerId, order.customerId))).limit(1) : [];
    if (order.outletId && !outlet) throw new Error("منفذ تسليم الطلب لم يعد تابعاً للتاجر ضمن المؤسسة.");
    const [existing] = await tx.select({ id: salesOrders.id }).from(salesOrders).where(and(eq(salesOrders.organizationId, organizationId), eq(salesOrders.b2bOrderId, order.id))).limit(1);
    if (existing) throw new Error("تم تحويل طلب B2B هذا إلى Sales Order مسبقاً.");
    const requestedItems = await tx.select().from(b2bRetailerOrderItems).where(and(eq(b2bRetailerOrderItems.organizationId, organizationId), eq(b2bRetailerOrderItems.orderId, order.id)));
    if (!requestedItems.length) throw new Error("لا يحتوي طلب B2B على بنود قابلة للتحويل.");
    if (input.action === "reject") {
      if (!input.reason?.trim()) throw new Error("سبب الرفض مطلوب.");
      await tx.insert(b2bOrderReviews).values({ organizationId, b2bOrderId: order.id, status: "rejected", reason: input.reason.trim(), reviewedByUserId: actorUserId });
      await tx.update(b2bRetailerOrders).set({ status: "cancelled" }).where(and(eq(b2bRetailerOrders.id, order.id), eq(b2bRetailerOrders.organizationId, organizationId)));
      await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_order.rejected", entityType: "b2b_order", entityId: String(order.id), metadata: { reason: input.reason.trim() } });
      await tx.insert(notifications).values({ organizationId, targetUserId: retailerAccess.userId, targetRetailerAccessId: order.accessId, type: "retail_order_rejected", severity: "warning", title: "تم رفض طلب Retail", content: `تم رفض الطلب ${order.orderNumber}: ${input.reason.trim()}`, isRead: "no" });
      return { status: "rejected" as const, orderId: order.id };
    }
    const adjustments = new Map((input.lines ?? []).map(line => [line.orderItemId, line]));
    const confirmed = requestedItems.map(item => {
      const change = adjustments.get(item.id);
      const quantity = change ? change.quantity : Number(item.quantity);
      const unitPrice = change?.unitPrice ?? Number(item.unitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("تعديل طلب B2B غير صالح.");
      return { item, quantity, unitPrice, lineTotal: roundMoney(quantity * unitPrice * (1 + Number(item.taxRate) / 100)), reason: change?.reason?.trim() };
    });
    const changed = confirmed.filter(line => line.quantity !== Number(line.item.quantity) || line.unitPrice !== Number(line.item.unitPrice));
    if (changed.some(line => !line.reason)) throw new Error("سبب التعديل مطلوب لكل كمية أو سعر معدل.");
    const subtotal = roundMoney(confirmed.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const taxAmount = roundMoney(confirmed.reduce((sum, line) => sum + line.lineTotal - line.quantity * line.unitPrice, 0));
    const totalAmount = roundMoney(subtotal + taxAmount);
    const inserted = await tx.insert(salesOrders).values({ organizationId, b2bOrderId: order.id, customerId: order.customerId, deliveryOutletId: outlet?.id, deliveryAddressSnapshot: outlet ? [outlet.name, outlet.address, outlet.commune, outlet.wilaya, outlet.deliveryInstructions].filter(Boolean).join(" · ") : undefined, deliveryLatitude: outlet?.latitude, deliveryLongitude: outlet?.longitude, deliveryTerritoryId: outlet?.territoryId, orderNumber: salesOrderNumber(), source: "b2b", status: "confirmed", currencyCode: order.currencyCode, subtotal: String(subtotal), taxAmount: String(taxAmount), totalAmount: String(totalAmount), requestedDeliveryDate: order.requestedDeliveryDate, confirmedDeliveryDate: input.confirmedDeliveryDate ?? order.requestedDeliveryDate, notes: order.notes, createdByUserId: actorUserId, confirmedByUserId: actorUserId });
    const salesOrderId = Number(inserted[0].insertId);
    await tx.insert(salesOrderItems).values(confirmed.map(line => {
      const requestedQuantity = Number(line.item.quantity);
      const requestedPaid = Number(line.item.paidQuantity || line.item.quantity);
      const ratio = requestedQuantity > 0 ? line.quantity / requestedQuantity : 1;
      const paidQuantity = roundMoney(requestedPaid * ratio);
      return { organizationId, salesOrderId, productId: line.item.productId, unit: line.item.unit, quantity: String(line.quantity), paidQuantity: String(paidQuantity), freeQuantity: String(Math.max(0, line.quantity - paidQuantity)), promotionId: line.item.promotionId, unitPrice: String(line.unitPrice), taxRate: line.item.taxRate, lineTotal: String(line.lineTotal) };
    }));
    if (changed.length) await tx.insert(b2bOrderAdjustments).values(changed.map(line => ({ organizationId, b2bOrderId: order.id, b2bOrderItemId: line.item.id, requestedQuantity: line.item.quantity, confirmedQuantity: String(line.quantity), requestedUnitPrice: line.item.unitPrice, confirmedUnitPrice: String(line.unitPrice), reason: line.reason!, createdByUserId: actorUserId })));
    await tx.insert(b2bOrderReviews).values([{ organizationId, b2bOrderId: order.id, status: "approved", reviewedByUserId: actorUserId }, { organizationId, b2bOrderId: order.id, status: "converted", reviewedByUserId: actorUserId }]);
    await tx.update(b2bRetailerOrders).set({ status: "confirmed", subtotal: String(subtotal), taxAmount: String(taxAmount), totalAmount: String(totalAmount) }).where(and(eq(b2bRetailerOrders.id, order.id), eq(b2bRetailerOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_order.converted_to_sales_order", entityType: "b2b_order", entityId: String(order.id), metadata: { salesOrderId, changedLines: changed.length } });
    await tx.insert(notifications).values({ organizationId, targetUserId: retailerAccess.userId, targetRetailerAccessId: order.accessId, type: "retail_order_approved", severity: "success", title: "تم اعتماد طلب Retail", content: `تم اعتماد الطلب ${order.orderNumber} وتحويله إلى أمر مبيعات.`, isRead: "no" });
    return { status: "converted" as const, orderId: order.id, salesOrderId };
  });
}

export async function cancelRetailerOrder(userId: number, accessId: number, orderId: number, reason?: string) {
  const access = await requireRetailerAccess(userId, accessId);
  assertRetailerPermission(access.access, "retail.orders.cancel");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.id, orderId), eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id))).limit(1);
  if (!order || (order.status !== "new" && order.status !== "review")) throw new Error("الطلب غير متاح للإلغاء.");
  const [linked] = await db.select({ id: salesOrders.id }).from(salesOrders).where(and(eq(salesOrders.organizationId, access.access.organizationId), eq(salesOrders.b2bOrderId, order.id))).limit(1);
  if (linked) throw new Error("تم تحويل الطلب إلى Sales Order؛ استخدم دورة إلغاء أمر المبيعات.");
  await db.transaction(async tx => {
    await tx.update(b2bRetailerOrders).set({ status: "cancelled" }).where(and(eq(b2bRetailerOrders.id, order.id), eq(b2bRetailerOrders.organizationId, access.access.organizationId)));
    await tx.insert(b2bOrderReviews).values({ organizationId: access.access.organizationId, b2bOrderId: order.id, status: "cancelled", reason: reason?.trim(), reviewedByUserId: userId });
    await tx.insert(auditLogs).values({ organizationId: access.access.organizationId, actorUserId: userId, action: "b2b_order.cancelled_by_retailer", entityType: "b2b_order", entityId: String(order.id), metadata: { reason: reason?.trim() ?? null } });
  });
  return { status: "cancelled" as const };
}

export async function listRetailerNotifications(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({ id: notifications.id, type: notifications.type, severity: notifications.severity, title: notifications.title, content: notifications.content, isRead: notifications.isRead, createdAt: notifications.createdAt }).from(notifications).where(and(eq(notifications.organizationId, access.access.organizationId), eq(notifications.targetUserId, userId), eq(notifications.targetRetailerAccessId, access.access.id))).orderBy(desc(notifications.createdAt)).limit(50);
}
