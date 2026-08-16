import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, b2bRetailerAccesses, b2bRetailerOrderItems, b2bRetailerOrders, businessParties, distributionRouteStops, distributionRoutes, organizations, priceListItems, priceLists, productBatches, products, salesInvoices } from "../drizzle/schema";
import { getDb } from "./db";

type CatalogInput = { query?: string; categoryId?: number; brandId?: number; favoritesOnly?: boolean };
type OrderLine = { productId: number; quantity: number; unit?: string };

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const orderNumber = () => `B2B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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

export async function listRetailerAccesses(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({ id: b2bRetailerAccesses.id, organizationId: b2bRetailerAccesses.organizationId, organizationName: organizations.name, organizationCurrency: organizations.baseCurrency, customerId: b2bRetailerAccesses.customerId, customerName: businessParties.name, status: b2bRetailerAccesses.status, deliveryTrackingPolicy: b2bRetailerAccesses.deliveryTrackingPolicy }).from(b2bRetailerAccesses).innerJoin(organizations, eq(organizations.id, b2bRetailerAccesses.organizationId)).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).where(and(eq(b2bRetailerAccesses.userId, userId), eq(b2bRetailerAccesses.status, "active"), eq(organizations.status, "active"), eq(businessParties.status, "active"))).orderBy(asc(organizations.name));
}

export async function requireRetailerAccess(userId: number, accessId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ access: b2bRetailerAccesses, organization: organizations, customer: businessParties }).from(b2bRetailerAccesses).innerJoin(organizations, eq(organizations.id, b2bRetailerAccesses.organizationId)).innerJoin(businessParties, and(eq(businessParties.id, b2bRetailerAccesses.customerId), eq(businessParties.organizationId, b2bRetailerAccesses.organizationId))).where(and(eq(b2bRetailerAccesses.id, accessId), eq(b2bRetailerAccesses.userId, userId), eq(b2bRetailerAccesses.status, "active"), eq(organizations.status, "active"), eq(businessParties.status, "active"))).limit(1);
  if (!rows[0] || !rows[0].customer.types.includes("customer")) throw new Error("لا توجد علاقة وصول B2B نشطة لهذه المؤسسة.");
  return rows[0];
}

async function resolveRetailerProduct(access: Awaited<ReturnType<typeof requireRetailerAccess>>, productId: number, requestedUnit?: string) {
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
  return { product, unit, unitPrice: Number(matchingItem?.price ?? product.salePrice), taxRate: Number(product.taxRate), currencyCode: matchingItem?.currencyCode ?? access.organization.baseCurrency, pricingSource: matchingItem ? `price_list_${matchingItem.listId}` : "default_product_price", availability };
}

export async function getRetailerCatalog(userId: number, accessId: number, input: CatalogInput = {}) {
  const access = await requireRetailerAccess(userId, accessId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const clauses = [eq(products.organizationId, access.access.organizationId), eq(products.status, "active")];
  if (input.categoryId) clauses.push(eq(products.categoryId, input.categoryId));
  if (input.brandId) clauses.push(eq(products.brandId, input.brandId));
  if (input.query?.trim()) clauses.push(sql`(${products.name} like ${`%${input.query.trim()}%`} or ${products.sku} like ${`%${input.query.trim()}%`})`);
  const rows = await db.select().from(products).where(and(...clauses)).orderBy(asc(products.name)).limit(200);
  return Promise.all(rows.map(async product => {
    const resolved = await resolveRetailerProduct(access, product.id);
    return { id: product.id, name: product.name, nameAr: product.nameAr, nameFr: product.nameFr, nameEn: product.nameEn, sku: product.sku, imageUrl: product.imageUrl, categoryId: product.categoryId, brandId: product.brandId, salesUnit: product.salesUnit, unitsPerCarton: product.unitsPerCarton, unitPrice: resolved.unitPrice, currencyCode: resolved.currencyCode, pricingSource: resolved.pricingSource, availability: resolved.availability };
  }));
}

export async function listRetailerOrders(userId: number, accessId: number) {
  const access = await requireRetailerAccess(userId, accessId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ order: b2bRetailerOrders, routeStatus: distributionRoutes.status, stopStatus: distributionRouteStops.deliveryStatus }).from(b2bRetailerOrders).leftJoin(distributionRoutes, and(eq(distributionRoutes.id, b2bRetailerOrders.routeId), eq(distributionRoutes.organizationId, b2bRetailerOrders.organizationId))).leftJoin(distributionRouteStops, and(eq(distributionRouteStops.id, b2bRetailerOrders.routeStopId), eq(distributionRouteStops.organizationId, b2bRetailerOrders.organizationId))).where(and(eq(b2bRetailerOrders.organizationId, access.access.organizationId), eq(b2bRetailerOrders.accessId, access.access.id), eq(b2bRetailerOrders.customerId, access.customer.id))).orderBy(desc(b2bRetailerOrders.createdAt)).limit(100);
  return rows.map(({ order, routeStatus, stopStatus }) => ({ ...order, displayStatus: stopStatus === "delivered" ? "delivered" : stopStatus === "partial" ? "partial" : stopStatus === "returned" ? "returned" : routeStatus === "started" || routeStatus === "in_progress" ? "in_transit" : order.status, deliveryTrackingPolicy: access.access.deliveryTrackingPolicy }));
}

export async function createRetailerOrder(userId: number, accessId: number, input: { lines: OrderLine[]; notes?: string; requestedDeliveryDate?: Date }) {
  const access = await requireRetailerAccess(userId, accessId);
  if (!input.lines.length || input.lines.length > 100) throw new Error("يجب أن يحتوي الطلب على بند واحد على الأقل وبحد أقصى 100 بند.");
  const normalized = [] as Array<{ productId: number; unit: string; quantity: number; unitPrice: number; taxRate: number; lineTotal: number; pricingSource: string; currencyCode: string }>;
  for (const line of input.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("كمية أحد بنود الطلب غير صالحة.");
    const resolved = await resolveRetailerProduct(access, line.productId, line.unit);
    if (resolved.availability === "out_of_stock") throw new Error("أحد منتجات الطلب غير متاح حالياً.");
    const beforeTax = roundMoney(line.quantity * resolved.unitPrice);
    const tax = roundMoney(beforeTax * (resolved.taxRate / 100));
    normalized.push({ productId: line.productId, unit: resolved.unit, quantity: line.quantity, unitPrice: resolved.unitPrice, taxRate: resolved.taxRate, lineTotal: roundMoney(beforeTax + tax), pricingSource: resolved.pricingSource, currencyCode: resolved.currencyCode });
  }
  const currencyCode = normalized[0]!.currencyCode;
  if (normalized.some(line => line.currencyCode !== currencyCode)) throw new Error("لا يمكن خلط عملات متعددة في طلب B2B واحد.");
  const subtotal = roundMoney(normalized.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const taxAmount = roundMoney(normalized.reduce((sum, line) => sum + (line.lineTotal - line.quantity * line.unitPrice), 0));
  const totalAmount = roundMoney(subtotal + taxAmount);
  if (Number(access.customer.creditLimit) > 0 && totalAmount > Number(access.customer.creditLimit)) throw new Error("يتجاوز الطلب حد الائتمان المسموح به للمحل.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const inserted = await tx.insert(b2bRetailerOrders).values({ organizationId: access.access.organizationId, accessId: access.access.id, customerId: access.customer.id, orderNumber: orderNumber(), currencyCode, subtotal: String(subtotal), taxAmount: String(taxAmount), totalAmount: String(totalAmount), requestedDeliveryDate: input.requestedDeliveryDate, notes: input.notes?.trim(), createdByUserId: userId });
    const orderId = Number(inserted[0].insertId);
    await tx.insert(b2bRetailerOrderItems).values(normalized.map(line => ({ organizationId: access.access.organizationId, orderId, productId: line.productId, unit: line.unit, quantity: String(line.quantity), unitPrice: String(line.unitPrice), taxRate: String(line.taxRate), lineTotal: String(line.lineTotal), pricingSource: line.pricingSource })));
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
