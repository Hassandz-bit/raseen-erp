import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, b2bOrderAdjustments, b2bOrderReviews, b2bPromotions, b2bRetailerAccesses, b2bRetailerFavorites, b2bRetailerOrderItems, b2bRetailerOrders, b2bRetailerOutlets, businessParties, distributionRouteStops, distributionRoutes, organizations, priceListItems, priceLists, productBatches, productPackagingLevels, products, salesInvoices, salesOrderItems, salesOrders } from "../drizzle/schema";
import { getDb } from "./db";

type CatalogInput = { query?: string; categoryId?: number; brandId?: number; favoritesOnly?: boolean };
type OrderLine = { productId: number; quantity: number; unit?: string };

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const orderNumber = () => `B2B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const salesOrderNumber = () => `SO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export async function grantRetailerAccess(organizationId: number, actorUserId: number, input: { customerId: number; userId: number; priceListId?: number; customerSegment?: string; territoryId?: number; deliveryTrackingPolicy?: "off" | "status_only" | "eta_only" | "limited_live"; availabilityDisclosure?: "available" | "low" | "request"; permissions?: Record<string, boolean> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [customer] = await db.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).limit(1);
  if (!customer || !customer.types.includes("customer")) throw new Error("يجب ربط وصول B2B بعميل نشط قائم داخل المؤسسة.");
  await db.insert(b2bRetailerAccesses).values({ organizationId, customerId: input.customerId, userId: input.userId, status: "active", priceListId: input.priceListId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, deliveryTrackingPolicy: input.deliveryTrackingPolicy ?? "status_only", availabilityDisclosure: input.availabilityDisclosure ?? "available", permissions: input.permissions, grantedAt: new Date() }).onDuplicateKeyUpdate({ set: { status: "active", priceListId: input.priceListId, customerSegment: input.customerSegment?.trim(), territoryId: input.territoryId, deliveryTrackingPolicy: input.deliveryTrackingPolicy ?? "status_only", availabilityDisclosure: input.availabilityDisclosure ?? "available", permissions: input.permissions, grantedAt: new Date(), revokedAt: null } });
  const [access] = await db.select().from(b2bRetailerAccesses).where(and(eq(b2bRetailerAccesses.organizationId, organizationId), eq(b2bRetailerAccesses.customerId, input.customerId), eq(b2bRetailerAccesses.userId, input.userId))).limit(1);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.access_granted", entityType: "b2b_retailer_access", entityId: String(access?.id ?? ""), metadata: { customerId: input.customerId, userId: input.userId } });
  return access;
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
  return db.select({ id: b2bRetailerAccesses.id, organizationId: b2bRetailerAccesses.organizationId, organizationName: organizations.name, organizationCurrency: organizations.baseCurrency, customerId: b2bRetailerAccesses.customerId, customerName: businessParties.name, status: b2bRetailerAccesses.status, deliveryTrackingPolicy: b2bRetailerAccesses.deliveryTrackingPolicy }).from(b2bRetailerAccesses).innerJoin(organizations, eq(organizations.id, b2bRetailerAccesses.organizationId)).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).where(and(eq(b2bRetailerAccesses.userId, userId), eq(b2bRetailerAccesses.status, "active"), eq(organizations.status, "active"), eq(businessParties.status, "active"))).orderBy(asc(organizations.name));
}

export async function listManagedRetailerAccesses(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({ id: b2bRetailerAccesses.id, userId: b2bRetailerAccesses.userId, customerId: b2bRetailerAccesses.customerId, customerName: businessParties.name, status: b2bRetailerAccesses.status, priceListId: b2bRetailerAccesses.priceListId, priceListName: priceLists.name, customerSegment: b2bRetailerAccesses.customerSegment, territoryId: b2bRetailerAccesses.territoryId, deliveryTrackingPolicy: b2bRetailerAccesses.deliveryTrackingPolicy, availabilityDisclosure: b2bRetailerAccesses.availabilityDisclosure, permissions: b2bRetailerAccesses.permissions, grantedAt: b2bRetailerAccesses.grantedAt, revokedAt: b2bRetailerAccesses.revokedAt }).from(b2bRetailerAccesses).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).leftJoin(priceLists, and(eq(priceLists.id, b2bRetailerAccesses.priceListId), eq(priceLists.organizationId, b2bRetailerAccesses.organizationId))).where(eq(b2bRetailerAccesses.organizationId, organizationId)).orderBy(asc(businessParties.name));
}

export async function listRetailerOutlets(organizationId: number, customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(b2bRetailerOutlets).where(and(eq(b2bRetailerOutlets.organizationId, organizationId), eq(b2bRetailerOutlets.customerId, customerId))).orderBy(asc(b2bRetailerOutlets.name));
}

export async function createRetailerOutlet(organizationId: number, actorUserId: number, input: { customerId: number; code: string; name: string; address?: string; latitude?: number; longitude?: number; territoryId?: number }) {
  if (!input.code.trim() || !input.name.trim()) throw new Error("رمز واسم منفذ التاجر مطلوبان.");
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;
  if (hasLatitude !== hasLongitude || (hasLatitude && (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude!) > 90 || Math.abs(input.longitude!) > 180))) throw new Error("إحداثيات منفذ التاجر غير صالحة.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [customer] = await db.select({ id: businessParties.id }).from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).limit(1);
  if (!customer) throw new Error("عميل التاجر غير موجود ضمن المؤسسة.");
  const inserted = await db.insert(b2bRetailerOutlets).values({ organizationId, customerId: input.customerId, code: input.code.trim(), name: input.name.trim(), address: input.address?.trim(), latitude: hasLatitude ? String(input.latitude) : undefined, longitude: hasLongitude ? String(input.longitude) : undefined, territoryId: input.territoryId });
  const id = Number(inserted[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_retailer.outlet_created", entityType: "b2b_retailer_outlet", entityId: String(id), metadata: { customerId: input.customerId, hasLocation: hasLatitude } });
  return { id };
}

export async function requireRetailerAccess(userId: number, accessId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ access: b2bRetailerAccesses, organization: organizations, customer: businessParties }).from(b2bRetailerAccesses).innerJoin(organizations, eq(organizations.id, b2bRetailerAccesses.organizationId)).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.userId, userId), eq(b2bRetailerAccesses.status, "active"), eq(organizations.status, "active"), eq(businessParties.status, "active"))).limit(1);
  if (!rows[0] || !rows[0].customer.types.includes("customer")) throw new Error("لا توجد علاقة وصول B2B نشطة لهذه المؤسسة.");
  return rows[0];
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
    return { id: product.id, name: product.name, nameAr: product.nameAr, nameFr: product.nameFr, nameEn: product.nameEn, sku: product.sku, imageUrl: product.imageUrl, categoryId: product.categoryId, brandId: product.brandId, salesUnit: product.salesUnit, unitsPerCarton: product.unitsPerCarton, unitPrice: resolved.unitPrice, currencyCode: resolved.currencyCode, pricingSource: resolved.pricingSource, promotionLabel: resolved.promotionLabel, availability: resolved.availability, packagingLevels };
  }));
}

export async function toggleRetailerFavorite(userId: number, accessId: number, productId: number) {
  const access = await requireRetailerAccess(userId, accessId);
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
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [orders, invoices, promotions] = await Promise.all([
    db.select({ status: b2bRetailerOrders.status }).from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).limit(200),
    db.select({ grandTotal: salesInvoices.grandTotal, amountPaid: salesInvoices.amountPaid }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, access.access.organizationId), eq(salesInvoices.customerId, access.customer.id))).limit(200),
    db.select({ id: b2bPromotions.id, customerId: b2bPromotions.customerId, customerSegment: b2bPromotions.customerSegment, territoryId: b2bPromotions.territoryId }).from(b2bPromotions).where(and(eq(b2bPromotions.organizationId, access.access.organizationId), eq(b2bPromotions.status, "active"), eq(b2bPromotions.visibleToB2b, "yes"), sql`${b2bPromotions.startsAt} <= ${new Date()}`, sql`${b2bPromotions.endsAt} >= ${new Date()}`)).limit(200),
  ]);
  const activeStatuses = new Set(["new", "review", "confirmed", "preparing", "ready", "loaded", "in_transit", "arrived", "partial"]);
  return { activeOrders: orders.filter(order => activeStatuses.has(order.status)).length, outstandingBalance: roundMoney(invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid)), 0)), currencyCode: access.organization.baseCurrency, activePromotions: promotions.filter(promotion => (!promotion.customerId || promotion.customerId === access.customer.id) && (!promotion.customerSegment || promotion.customerSegment === access.access.customerSegment) && (!promotion.territoryId || promotion.territoryId === access.access.territoryId)).length };
}

export async function getRetailerMonthlyReport(userId: number, accessId: number, month: number, year: number) {
  const access = await requireRetailerAccess(userId, accessId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const startsAt = new Date(Date.UTC(year, month - 1, 1));
  const endsAt = new Date(Date.UTC(year, month, 1));
  const [orders, invoices] = await Promise.all([
    db.select({ id: b2bRetailerOrders.id, orderNumber: b2bRetailerOrders.orderNumber, status: b2bRetailerOrders.status, paymentStatus: b2bRetailerOrders.paymentStatus, currencyCode: b2bRetailerOrders.currencyCode, totalAmount: b2bRetailerOrders.totalAmount, createdAt: b2bRetailerOrders.createdAt }).from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id), sql`${b2bRetailerOrders.createdAt} >= ${startsAt}`, sql`${b2bRetailerOrders.createdAt} < ${endsAt}`)).orderBy(desc(b2bRetailerOrders.createdAt)).limit(500),
    db.select({ id: salesInvoices.id, invoiceNumber: salesInvoices.invoiceNumber, status: salesInvoices.status, currencyCode: salesInvoices.currencyCode, grandTotal: salesInvoices.grandTotal, amountPaid: salesInvoices.amountPaid, issuedAt: salesInvoices.issuedAt }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, access.access.organizationId), eq(salesInvoices.customerId, access.customer.id), sql`${salesInvoices.issuedAt} >= ${startsAt}`, sql`${salesInvoices.issuedAt} < ${endsAt}`)).orderBy(desc(salesInvoices.issuedAt)).limit(500),
  ]);
  const orderTotal = roundMoney(orders.reduce((sum, order) => sum + Number(order.totalAmount), 0));
  const invoicedTotal = roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0));
  const outstandingBalance = roundMoney(invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid)), 0));
  return { period: { month, year, startsAt, endsAt }, currencyCode: access.organization.baseCurrency, summary: { orderCount: orders.length, orderTotal, invoiceCount: invoices.length, invoicedTotal, outstandingBalance }, orders, invoices };
}

export async function listRetailerOrders(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ order: b2bRetailerOrders, salesOrder: salesOrders, routeStatus: distributionRoutes.status, stopStatus: distributionRouteStops.deliveryStatus }).from(b2bRetailerOrders).leftJoin(salesOrders, and(eq(salesOrders.b2bOrderId, b2bRetailerOrders.id), eq(salesOrders.organizationId, b2bRetailerOrders.organizationId))).leftJoin(distributionRouteStops, and(eq(distributionRouteStops.salesOrderReference, salesOrders.orderNumber), eq(distributionRouteStops.organizationId, b2bRetailerOrders.organizationId))).leftJoin(distributionRoutes, and(eq(distributionRoutes.id, distributionRouteStops.routeId), eq(distributionRoutes.organizationId, b2bRetailerOrders.organizationId))).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).orderBy(desc(b2bRetailerOrders.createdAt)).limit(100);
  const ids = rows.map(row => row.order.id);
  const reviews = ids.length ? await db.select().from(b2bOrderReviews).where(and(eq(b2bOrderReviews.organizationId, access.access.organizationId), inArray(b2bOrderReviews.b2bOrderId, ids))).orderBy(asc(b2bOrderReviews.reviewedAt)) : [];
  return rows.map(({ order, salesOrder, routeStatus, stopStatus }) => {
    const timeline = [{ key: "submitted", at: order.createdAt }];
    for (const review of reviews.filter(item => item.b2bOrderId === order.id)) timeline.push({ key: review.status, at: review.reviewedAt });
    if (salesOrder?.status === "preparing") timeline.push({ key: "preparing", at: salesOrder.updatedAt });
    if (salesOrder?.status === "ready") timeline.push({ key: "ready", at: salesOrder.updatedAt });
    if (salesOrder?.status === "loaded") timeline.push({ key: "loaded", at: salesOrder.updatedAt });
    if (routeStatus === "started" || routeStatus === "in_progress") timeline.push({ key: "in_transit", at: salesOrder?.updatedAt ?? order.createdAt });
    if (stopStatus === "delivered" || stopStatus === "partial") timeline.push({ key: stopStatus, at: salesOrder?.updatedAt ?? order.createdAt });
    const displayStatus = stopStatus === "delivered" ? "delivered" : stopStatus === "partial" ? "partial" : routeStatus === "started" || routeStatus === "in_progress" ? "in_transit" : salesOrder?.status ?? order.status;
    return { ...order, salesOrderId: salesOrder?.id, salesOrderNumber: salesOrder?.orderNumber, confirmedTotal: salesOrder?.totalAmount, displayStatus, timeline, deliveryTrackingPolicy: access.access.deliveryTrackingPolicy };
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

export async function createRetailerOrder(userId: number, accessId: number, input: { lines: OrderLine[]; notes?: string; requestedDeliveryDate?: Date }) {
  const access = await requireRetailerAccess(userId, accessId);
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
  if (Number(access.customer.creditLimit) > 0 && totalAmount > Number(access.customer.creditLimit)) throw new Error("يتجاوز الطلب حد الائتمان المسموح به للمحل.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const inserted = await tx.insert(b2bRetailerOrders).values({ organizationId: access.access.organizationId, accessId: access.access.id, customerId: access.customer.id, orderNumber: orderNumber(), currencyCode, subtotal: String(subtotal), taxAmount: String(taxAmount), totalAmount: String(totalAmount), requestedDeliveryDate: input.requestedDeliveryDate, notes: input.notes?.trim(), createdByUserId: userId });
    const orderId = Number(inserted[0].insertId);
    await tx.insert(b2bRetailerOrderItems).values(normalized.map(line => ({ organizationId: access.access.organizationId, orderId, productId: line.productId, unit: line.unit, quantity: String(line.quantity), paidQuantity: String(line.paidQuantity), freeQuantity: String(line.freeQuantity), promotionId: line.promotionId, unitPrice: String(line.unitPrice), taxRate: String(line.taxRate), lineTotal: String(line.lineTotal), pricingSource: line.pricingSource, promotionLabel: line.promotionLabel })));
    return { id: orderId, totalAmount, currencyCode, status: "new" as const };
  });
}

export async function reorderRetailerOrder(userId: number, accessId: number, orderId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(b2bRetailerOrders).where(and(eq(b2bRetailerOrders.id, orderId), eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).limit(1);
  if (!order) throw new Error("الطلب السابق غير متاح لإعادة الطلب.");
  const items = await db.select().from(b2bRetailerOrderItems).where(and(eq(b2bRetailerOrderItems.organizationId, access.access.organizationId), eq(b2bRetailerOrderItems.orderId, orderId)));
  return createRetailerOrder(userId, accessId, { lines: items.map(item => ({ productId: item.productId, quantity: Number(item.quantity), unit: item.unit })), notes: `إعادة طلب من ${order.orderNumber}` });
}

export async function listRetailerDocuments(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
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
    if (order.status === "cancelled") throw new Error("لا يمكن مراجعة طلب ملغى.");
    const [existing] = await tx.select({ id: salesOrders.id }).from(salesOrders).where(and(eq(salesOrders.organizationId, organizationId), eq(salesOrders.b2bOrderId, order.id))).limit(1);
    if (existing) throw new Error("تم تحويل طلب B2B هذا إلى Sales Order مسبقاً.");
    const requestedItems = await tx.select().from(b2bRetailerOrderItems).where(and(eq(b2bRetailerOrderItems.organizationId, organizationId), eq(b2bRetailerOrderItems.orderId, order.id)));
    if (!requestedItems.length) throw new Error("لا يحتوي طلب B2B على بنود قابلة للتحويل.");
    if (input.action === "reject") {
      if (!input.reason?.trim()) throw new Error("سبب الرفض مطلوب.");
      await tx.insert(b2bOrderReviews).values({ organizationId, b2bOrderId: order.id, status: "rejected", reason: input.reason.trim(), reviewedByUserId: actorUserId });
      await tx.update(b2bRetailerOrders).set({ status: "cancelled" }).where(and(eq(b2bRetailerOrders.id, order.id), eq(b2bRetailerOrders.organizationId, organizationId)));
      await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "b2b_order.rejected", entityType: "b2b_order", entityId: String(order.id), metadata: { reason: input.reason.trim() } });
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
    const inserted = await tx.insert(salesOrders).values({ organizationId, b2bOrderId: order.id, customerId: order.customerId, orderNumber: salesOrderNumber(), source: "b2b", status: "confirmed", currencyCode: order.currencyCode, subtotal: String(subtotal), taxAmount: String(taxAmount), totalAmount: String(totalAmount), requestedDeliveryDate: order.requestedDeliveryDate, confirmedDeliveryDate: input.confirmedDeliveryDate ?? order.requestedDeliveryDate, notes: order.notes, createdByUserId: actorUserId, confirmedByUserId: actorUserId });
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
    return { status: "converted" as const, orderId: order.id, salesOrderId };
  });
}

export async function cancelRetailerOrder(userId: number, accessId: number, orderId: number, reason?: string) {
  const access = await requireRetailerAccess(userId, accessId);
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
