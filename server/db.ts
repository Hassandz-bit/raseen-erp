import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  branches,
  employees,
  businessParties,
  financialTransactions,
  InsertUser,
  inventoryBalances,
  inventoryCountItems,
  inventoryCounts,
  productBatches,
  notifications,
  organizationMemberships,
  organizationCurrencies,
  organizationExchangeRates,
  organizationModules,
  organizationRoles,
  organizationSettings,
  organizations,
  products,
  purchaseOrderItems,
  purchaseOrders,
  salesInvoiceItems,
  salesInvoices,
  stockMovements,
  stockTransferItems,
  stockTransfers,
  userPreferences,
  users,
  warehouses,
} from "../drizzle/schema";
import { getCurrencyCatalogEntry } from "../shared/currencyCatalog";
import { ENV } from "./_core/env";
import { canTransitionPurchaseDocument, canTransitionStockCount } from "./commerceDocumentPolicy";
import { isValidTextBarcode, normalizeTextBarcode } from "./barcodePolicy";
import { allocateSalesInvoiceLine, canTransitionSalesDocument } from "./inventoryPolicy";

let _db: ReturnType<typeof drizzle> | null = null;

export const defaultDocumentSettings = {
  paperSize: "A4" as const,
  headerText: "",
  footerText: "",
  showSignature: true,
  fontFamily: "noto-arabic" as const,
  fontSize: "normal" as const,
  vat: { defaultRate: 0, priceMode: "exclusive" as const },
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(userPreferences).values({ userId }).onDuplicateKeyUpdate({ set: { userId } });
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result[0];
}

export async function setActiveOrganizationForUser(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [membership] = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.status, "active")))
    .limit(1);
  if (!membership) throw new Error("لا تملك عضوية نشطة في المؤسسة المطلوبة.");
  await updateUserPreferences(userId, { activeOrganizationId: organizationId });
  return getOrCreateUserPreferences(userId);
}

export async function updateUserPreferences(userId: number, values: Partial<typeof userPreferences.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(userPreferences).values({ userId, ...values }).onDuplicateKeyUpdate({ set: values });
  return getOrCreateUserPreferences(userId);
}

export async function getOrCreateOrganizationSettings(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(organizationSettings).values({ organizationId, documentSettings: defaultDocumentSettings }).onDuplicateKeyUpdate({ set: { organizationId } });
  const result = await db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, organizationId)).limit(1);
  return result[0];
}

export async function updateOrganizationSettings(organizationId: number, values: Partial<typeof organizationSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.insert(organizationSettings).values({ organizationId, documentSettings: defaultDocumentSettings, ...values }).onDuplicateKeyUpdate({ set: values });
  return getOrCreateOrganizationSettings(organizationId);
}

export async function listOrganizationCurrencies(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const settings = await getOrCreateOrganizationSettings(organizationId);
  const base = getCurrencyCatalogEntry(settings.currencyCode);
  if (base) await db.insert(organizationCurrencies).values({ organizationId, currencyCode: base.code, symbol: base.symbol, decimalPlaces: base.decimalPlaces, isBase: "yes", status: "active" }).onDuplicateKeyUpdate({ set: { isBase: "yes", status: "active" } });
  return db.select().from(organizationCurrencies).where(eq(organizationCurrencies.organizationId, organizationId)).orderBy(desc(organizationCurrencies.isBase), organizationCurrencies.currencyCode);
}

export async function saveOrganizationCurrency(organizationId: number, values: { currencyCode: string; symbol: string; decimalPlaces: number; displayStyle: "symbol" | "code" | "symbol_and_code"; status: "active" | "inactive"; isBase?: "yes" | "no" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (values.isBase === "yes") {
    await db.update(organizationCurrencies).set({ isBase: "no" }).where(eq(organizationCurrencies.organizationId, organizationId));
    await updateOrganizationSettings(organizationId, { currencyCode: values.currencyCode, decimalPlaces: values.decimalPlaces });
  }
  await db.insert(organizationCurrencies).values({ organizationId, ...values, isBase: values.isBase ?? "no" }).onDuplicateKeyUpdate({ set: { symbol: values.symbol, decimalPlaces: values.decimalPlaces, displayStyle: values.displayStyle, status: values.status, isBase: values.isBase ?? "no" } });
  return listOrganizationCurrencies(organizationId);
}

export async function listOrganizationExchangeRates(organizationId: number, filters?: { currencyCode?: string; startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const conditions = [eq(organizationExchangeRates.organizationId, organizationId)];
  if (filters?.currencyCode) conditions.push(sql`(${organizationExchangeRates.baseCurrencyCode} = ${filters.currencyCode} OR ${organizationExchangeRates.quoteCurrencyCode} = ${filters.currencyCode})`);
  if (filters?.startDate) conditions.push(sql`${organizationExchangeRates.effectiveAt} >= ${filters.startDate}`);
  if (filters?.endDate) conditions.push(sql`${organizationExchangeRates.effectiveAt} <= ${filters.endDate}`);
  return db.select().from(organizationExchangeRates).where(and(...conditions)).orderBy(desc(organizationExchangeRates.effectiveAt), desc(organizationExchangeRates.id)).limit(200);
}

export async function addOrganizationExchangeRate(organizationId: number, userId: number, values: { baseCurrencyCode: string; quoteCurrencyCode: string; rate: number; effectiveAt: Date; source?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [organization] = await db.select({ baseCurrency: organizations.baseCurrency }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization) throw new Error("المؤسسة غير متاحة ضمن السياق الحالي.");
  const baseCurrencyCode = values.baseCurrencyCode.trim().toUpperCase();
  const quoteCurrencyCode = values.quoteCurrencyCode.trim().toUpperCase();
  if (baseCurrencyCode !== organization.baseCurrency.toUpperCase()) throw new Error("يجب أن تطابق عملة الأساس العملة الأساسية للمؤسسة.");
  if (baseCurrencyCode === quoteCurrencyCode) throw new Error("يجب أن تختلف عملة الأساس عن عملة الاقتباس.");
  const result = await db.insert(organizationExchangeRates).values({ organizationId, baseCurrencyCode, quoteCurrencyCode, rate: String(values.rate), effectiveAt: values.effectiveAt, source: values.source?.trim() || "manual", createdByUserId: userId });
  return { id: Number(result[0].insertId) };
}

export async function getOrganizationRolePermissions(organizationId: number, roleKey: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.select({ permissions: organizationRoles.permissions }).from(organizationRoles).where(and(eq(organizationRoles.organizationId, organizationId), eq(organizationRoles.key, roleKey))).limit(1);
  return result[0]?.permissions ?? [];
}

export async function createOrganizationForUser({ userId, name }: { userId: number; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const slug = `org-${userId}-${Date.now()}`;
  const moduleKeys = ["inventory", "sales", "purchases", "finance", "hr", "reports", "ai_assistant", "distribution", "manufacturing", "nawa_retail"];

  return db.transaction(async tx => {
    const inserted = await tx.insert(organizations).values({
      name,
      slug,
      status: "active",
      baseCurrency: "SAR",
      locale: "ar-SA",
      monthlyBudget: "0",
    });
    const organizationId = Number(inserted[0].insertId);
    await tx.insert(organizationMemberships).values({ organizationId, userId, roleKey: "owner", status: "active" });
    await tx.insert(organizationRoles).values({
      organizationId,
      key: "owner",
      name: "مالك المؤسسة",
      description: "دور كامل الصلاحية للمؤسسة.",
      permissions: ["*"],
    });
    await tx.insert(organizationModules).values(moduleKeys.map(moduleKey => ({
      organizationId,
      moduleKey,
      status: "active" as const,
      changeSource: "onboarding",
    })));
    await tx.insert(organizationSettings).values({ organizationId, documentSettings: defaultDocumentSettings });
    await tx.insert(userPreferences).values({ userId }).onDuplicateKeyUpdate({ set: { userId } });
    return { organizationId, name };
  });
}

export async function getDefaultTenantContext(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [preferences] = await db.select({ activeOrganizationId: userPreferences.activeOrganizationId }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const findContext = (organizationId?: number | null) => db
    .select({ organization: organizations, membership: organizationMemberships })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.status, "active"),
      eq(organizations.status, "active"),
      ...(organizationId ? [eq(organizations.id, organizationId)] : []),
    ))
    .orderBy(desc(organizationMemberships.updatedAt))
    .limit(1);
  const preferred = preferences?.activeOrganizationId ? await findContext(preferences.activeOrganizationId) : [];
  const row = preferred[0] ? preferred : await findContext();
  if (!row[0]) return undefined;
  const modules = await db.select().from(organizationModules).where(eq(organizationModules.organizationId, row[0].organization.id));
  return { ...row[0], modules };
}

export async function listProductsForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.organizationId, organizationId)).orderBy(desc(products.updatedAt));
}

export async function createProductMaster(organizationId: number, values: { sku: string; name: string; nameAr?: string; nameFr?: string; nameEn?: string; barcode?: string; categoryId?: number; brandId?: number; productType: "standard" | "food" | "expiring" | "manufacturable"; baseUnit: string; purchaseUnit: string; salesUnit: string; unitsPerCarton: number; purchasePrice: number; salePrice: number; taxRate: number; minimumStock: number; reorderPoint: number; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const barcode = values.barcode ? normalizeTextBarcode(values.barcode) : undefined;
  if (barcode && !isValidTextBarcode(barcode)) throw new Error("صيغة الباركود النصي غير صالحة.");
  const result = await db.insert(products).values({ organizationId, sku: values.sku, name: values.name, nameAr: values.nameAr, nameFr: values.nameFr, nameEn: values.nameEn, barcode, categoryId: values.categoryId, brandId: values.brandId, productType: values.productType, baseUnit: values.baseUnit, unit: values.baseUnit, purchaseUnit: values.purchaseUnit, salesUnit: values.salesUnit, unitsPerCarton: String(values.unitsPerCarton), purchasePrice: String(values.purchasePrice), salePrice: String(values.salePrice), taxRate: String(values.taxRate), minimumStock: String(values.minimumStock), reorderPoint: String(values.reorderPoint), description: values.description, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function createBusinessParty(organizationId: number, input: { name: string; types: string[]; code?: string; contactName?: string; phone?: string; email?: string; paymentTermsDays?: number; creditLimit?: number; preferredCurrencyCode?: string; customerSegment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(businessParties).values({ organizationId, name: input.name, types: input.types, code: input.code, contactName: input.contactName, phone: input.phone, email: input.email, paymentTermsDays: input.paymentTermsDays ?? 0, creditLimit: String(input.creditLimit ?? 0), preferredCurrencyCode: input.preferredCurrencyCode, customerSegment: input.customerSegment, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function listActiveCustomersForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const parties = await db.select({ id: businessParties.id, code: businessParties.code, name: businessParties.name, address: businessParties.address, visitPriority: businessParties.visitPriority, types: businessParties.types }).from(businessParties).where(and(eq(businessParties.organizationId, organizationId), eq(businessParties.status, "active"))).orderBy(asc(businessParties.name)).limit(500);
  return parties.filter(party => Array.isArray(party.types) && party.types.includes("customer"));
}

export async function listWarehousesForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(warehouses).where(eq(warehouses.organizationId, organizationId)).orderBy(warehouses.name).limit(100);
}

export async function listBranchesForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(branches).where(eq(branches.organizationId, organizationId)).orderBy(branches.name).limit(100);
}

export async function listOrganizationMembersForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select({
    id: organizationMemberships.id,
    userId: organizationMemberships.userId,
    roleKey: organizationMemberships.roleKey,
    status: organizationMemberships.status,
    name: users.name,
    email: users.email,
  }).from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId)).where(eq(organizationMemberships.organizationId, organizationId)).orderBy(users.name).limit(100);
}

export async function createBranchForOrganization(organizationId: number, input: { code: string; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(branches).values({ organizationId, code: input.code, name: input.name, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function createWarehouseForOrganization(organizationId: number, input: { code: string; name: string; isMobile?: "yes" | "no" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(warehouses).values({ organizationId, code: input.code, name: input.name, isMobile: input.isMobile ?? "no", status: "active" });
  return { id: Number(result[0].insertId) };
}

export type SalesInvoiceLineInput = {
  productId: number;
  warehouseId: number;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  taxRate?: number;
};

export type PurchaseOrderLineInput = {
  productId: number;
  warehouseId: number;
  quantity: number;
  unit?: string;
  unitCost: number;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function newDocumentNumber(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-10)}`;
}

export async function listSalesInvoicesForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(salesInvoices).where(eq(salesInvoices.organizationId, organizationId)).orderBy(desc(salesInvoices.updatedAt), desc(salesInvoices.id)).limit(100);
}

export async function getSalesInvoicePrintDataForOrganization(organizationId: number, invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [header] = await db.select({
    invoice: salesInvoices,
    organizationName: organizations.name,
    customerName: businessParties.name,
    documentSettings: organizationSettings.documentSettings,
  }).from(salesInvoices)
    .innerJoin(organizations, eq(organizations.id, salesInvoices.organizationId))
    .leftJoin(businessParties, and(eq(businessParties.id, salesInvoices.customerId), eq(businessParties.organizationId, salesInvoices.organizationId)))
    .leftJoin(organizationSettings, eq(organizationSettings.organizationId, salesInvoices.organizationId))
    .where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.id, invoiceId)))
    .limit(1);
  if (!header) throw new Error("لم يتم العثور على الفاتورة ضمن المؤسسة الحالية.");

  const items = await db.select({
    id: salesInvoiceItems.id,
    productName: products.name,
    sku: products.sku,
    quantity: salesInvoiceItems.quantity,
    unit: salesInvoiceItems.unit,
    unitPrice: salesInvoiceItems.unitPrice,
    taxRate: salesInvoiceItems.taxRate,
    lineTotal: salesInvoiceItems.lineTotal,
  }).from(salesInvoiceItems)
    .innerJoin(products, and(eq(products.id, salesInvoiceItems.productId), eq(products.organizationId, salesInvoiceItems.organizationId)))
    .where(and(eq(salesInvoiceItems.organizationId, organizationId), eq(salesInvoiceItems.invoiceId, invoiceId)))
    .orderBy(asc(salesInvoiceItems.id));

  return { ...header, items };
}

export async function listPurchaseOrdersForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId)).orderBy(desc(purchaseOrders.updatedAt), desc(purchaseOrders.id)).limit(100);
}

export async function createSalesInvoice(organizationId: number, actorUserId: number, input: { invoiceNumber?: string; customerId?: number; currencyCode: string; baseCurrencyCode: string; exchangeRateUsed?: number; dueDate?: Date; discountAmount?: number; taxMode?: "exclusive" | "inclusive"; taxRate?: number; lines: SalesInvoiceLineInput[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db.transaction(async tx => {
    if (input.customerId) {
      const customer = await tx.select().from(businessParties).where(and(eq(businessParties.id, input.customerId), eq(businessParties.organizationId, organizationId))).limit(1);
      if (!customer[0] || customer[0].status !== "active" || !customer[0].types.includes("customer")) throw new Error("العميل المحدد غير متاح ضمن المؤسسة الحالية.");
    }

    const [settings] = await tx.select({ documentSettings: organizationSettings.documentSettings }).from(organizationSettings).where(eq(organizationSettings.organizationId, organizationId)).limit(1);
    const vat = settings?.documentSettings?.vat;
    const taxMode = input.taxMode ?? vat?.priceMode ?? "exclusive";
    const configuredTaxRate = input.taxRate ?? vat?.defaultRate ?? 0;
    if (!Number.isFinite(configuredTaxRate) || configuredTaxRate < 0 || configuredTaxRate > 100) throw new Error("نسبة ضريبة القيمة المضافة يجب أن تكون بين 0 و100.");
    const normalizedLines: Array<{ productId: number; warehouseId: number; quantity: number; unit: string; unitPrice: number; taxRate: number; netAmount: number; lineTotal: number; taxAmount: number }> = [];
    for (const line of input.lines) {
      const product = await tx.select().from(products).where(and(eq(products.id, line.productId), eq(products.organizationId, organizationId))).limit(1);
      const warehouse = await tx.select().from(warehouses).where(and(eq(warehouses.id, line.warehouseId), eq(warehouses.organizationId, organizationId), eq(warehouses.status, "active"))).limit(1);
      if (!product[0] || product[0].status !== "active") throw new Error("أحد منتجات الفاتورة غير متاح ضمن المؤسسة الحالية.");
      if (!warehouse[0]) throw new Error("مخزن أحد أسطر الفاتورة غير متاح ضمن المؤسسة الحالية.");
      const unitPrice = line.unitPrice ?? Number(product[0].salePrice);
      const productTaxRate = Number(product[0].taxRate);
      const taxRate = line.taxRate ?? (productTaxRate > 0 ? productTaxRate : configuredTaxRate);
      const enteredLineAmount = roundMoney(line.quantity * unitPrice);
      const netAmount = taxMode === "inclusive" && taxRate > 0 ? roundMoney(enteredLineAmount / (1 + taxRate / 100)) : enteredLineAmount;
      const taxAmount = taxMode === "inclusive" ? roundMoney(enteredLineAmount - netAmount) : roundMoney(netAmount * (taxRate / 100));
      normalizedLines.push({ productId: line.productId, warehouseId: line.warehouseId, quantity: line.quantity, unit: line.unit?.trim() || product[0].salesUnit, unitPrice, taxRate, netAmount, lineTotal: taxMode === "inclusive" ? enteredLineAmount : roundMoney(netAmount + taxAmount), taxAmount });
    }

    const subtotal = roundMoney(normalizedLines.reduce((total, line) => total + line.netAmount, 0));
    const taxAmount = roundMoney(normalizedLines.reduce((total, line) => total + line.taxAmount, 0));
    const discountAmount = roundMoney(input.discountAmount ?? 0);
    if (discountAmount > subtotal + taxAmount) throw new Error("لا يمكن أن يتجاوز الخصم إجمالي الفاتورة.");
    const grandTotal = roundMoney(subtotal + taxAmount - discountAmount);
    const inserted = await tx.insert(salesInvoices).values({ organizationId, customerId: input.customerId, invoiceNumber: input.invoiceNumber?.trim() || newDocumentNumber("INV"), status: "draft", currencyCode: input.currencyCode, baseCurrencyCode: input.baseCurrencyCode, exchangeRateUsed: String(input.exchangeRateUsed ?? 1), taxMode, netAmount: String(subtotal), discountAmount: String(discountAmount), taxAmount: String(taxAmount), grandTotal: String(grandTotal), amountPaid: "0", dueDate: input.dueDate });
    const invoiceId = Number(inserted[0].insertId);
    await tx.insert(salesInvoiceItems).values(normalizedLines.map(line => ({ organizationId, invoiceId, productId: line.productId, warehouseId: line.warehouseId, quantity: String(line.quantity), unit: line.unit, unitPrice: String(line.unitPrice), taxRate: String(line.taxRate), lineTotal: String(line.lineTotal) })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "sales_invoice.created", entityType: "sales_invoice", entityId: String(invoiceId), metadata: { invoiceNumber: input.invoiceNumber?.trim() || null, lines: normalizedLines.length, netAmount: subtotal, taxAmount, grandTotal, taxMode } });
    return { id: invoiceId, status: "draft" as const, netAmount: subtotal, taxAmount, grandTotal, taxMode };
  });
}

export async function recordSalesInvoicePayment(organizationId: number, actorUserId: number, invoiceId: number, amount?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db.transaction(async tx => {
    const invoice = await tx.select().from(salesInvoices).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.organizationId, organizationId))).limit(1);
    if (!invoice[0] || !["issued", "partial", "overdue"].includes(invoice[0].status)) throw new Error("لا يمكن تسجيل دفعة لهذه الفاتورة من حالتها الحالية.");
    const outstanding = roundMoney(Number(invoice[0].grandTotal) - Number(invoice[0].amountPaid));
    const paymentAmount = roundMoney(amount ?? outstanding);
    if (paymentAmount <= 0 || paymentAmount > outstanding) throw new Error("قيمة الدفعة غير صالحة بالنسبة للرصيد المستحق.");
    const amountPaid = roundMoney(Number(invoice[0].amountPaid) + paymentAmount);
    const nextStatus = amountPaid >= Number(invoice[0].grandTotal) ? "paid" : "partial";
    if (!canTransitionSalesDocument(invoice[0].status, nextStatus)) throw new Error("انتقال حالة سداد الفاتورة غير مسموح.");
    await tx.update(salesInvoices).set({ status: nextStatus, amountPaid: String(amountPaid) }).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.organizationId, organizationId)));
    const transaction = await tx.insert(financialTransactions).values({ organizationId, type: "income", category: "تحصيل فاتورة مبيعات", amount: String(paymentAmount), occurredAt: new Date(), referenceType: "sales_invoice", referenceId: invoiceId, notes: `تحصيل من الفاتورة ${invoice[0].invoiceNumber}` });
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "sales_invoice.payment_recorded", entityType: "sales_invoice", entityId: String(invoiceId), metadata: { paymentAmount, amountPaid, status: nextStatus } });
    return { id: invoiceId, status: nextStatus, amountPaid, financialTransactionId: Number(transaction[0].insertId) };
  });
}

export type CommerceTransaction = {
  select: (...args: unknown[]) => any;
  update: (table: unknown) => any;
  insert: (table: unknown) => any;
};

export async function issueSalesInvoiceWithFefoInTransaction(tx: CommerceTransaction, organizationId: number, actorUserId: number, invoiceId: number) {
    const invoice = await tx.select().from(salesInvoices).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.organizationId, organizationId))).limit(1);
    if (!invoice[0]) throw new Error("فاتورة المبيعات غير متاحة ضمن المؤسسة الحالية.");
    if (!canTransitionSalesDocument(invoice[0].status, "issued")) throw new Error("لا يمكن إصدار الفاتورة من حالتها الحالية.");
    const lines = await tx.select().from(salesInvoiceItems).where(and(eq(salesInvoiceItems.organizationId, organizationId), eq(salesInvoiceItems.invoiceId, invoiceId)));
    if (!lines.length) throw new Error("لا يمكن إصدار فاتورة من دون أسطر.");

    const now = new Date();
    const issuedAllocations: Array<{ lineId: number; batchId: number; quantity: number }> = [];
    for (const line of lines) {
      const batches = await tx.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.productId, line.productId), eq(productBatches.warehouseId, line.warehouseId))).orderBy(asc(productBatches.expiryDate));
      const allocations = allocateSalesInvoiceLine(batches.map((batch: typeof productBatches.$inferSelect) => ({ id: batch.id, availableQuantity: Number(batch.currentQuantity) - Number(batch.reservedQuantity), expiryDate: batch.expiryDate, status: batch.status })), Number(line.quantity), now);

      for (const allocatedBatch of allocations) {
        const updateResult = await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} - ${allocatedBatch.quantity}` }).where(and(eq(productBatches.id, allocatedBatch.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.productId, line.productId), eq(productBatches.warehouseId, line.warehouseId), eq(productBatches.status, "active"), sql`${productBatches.currentQuantity} - ${productBatches.reservedQuantity} >= ${allocatedBatch.quantity}`, sql`(${productBatches.expiryDate} IS NULL OR ${productBatches.expiryDate} > ${now})`));
        if (!Number(updateResult[0]?.affectedRows ?? 0)) throw new Error("تعذر حجز كمية الدفعة بأمان؛ يرجى إعادة المحاولة.");
        await tx.insert(stockMovements).values({ organizationId, warehouseId: line.warehouseId, productId: line.productId, batchId: allocatedBatch.batchId, movementType: "sales_issue", quantity: String(-allocatedBatch.quantity), unit: line.unit, sourceDocumentType: "sales_invoice", sourceDocumentId: invoiceId, occurredAt: now, actorUserId, auditReference: `INV-${invoiceId}` });
        issuedAllocations.push({ lineId: line.id, batchId: allocatedBatch.batchId, quantity: allocatedBatch.quantity });
      }

      const actualBalance = await tx.select({ quantity: sql<string>`coalesce(sum(${productBatches.currentQuantity}), 0)` }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.productId, line.productId), eq(productBatches.warehouseId, line.warehouseId)));
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: line.warehouseId, productId: line.productId, quantity: String(actualBalance[0]?.quantity ?? 0), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: String(actualBalance[0]?.quantity ?? 0) } });
    }

    await tx.update(salesInvoices).set({ status: "issued", issuedAt: now }).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "sales_invoice.issued", entityType: "sales_invoice", entityId: String(invoiceId), metadata: { allocations: issuedAllocations } });
  return { id: invoiceId, status: "issued" as const, allocations: issuedAllocations };
}

export async function issueSalesInvoiceWithFefo(organizationId: number, actorUserId: number, invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(tx => issueSalesInvoiceWithFefoInTransaction(tx as CommerceTransaction, organizationId, actorUserId, invoiceId));
}

export async function createPurchaseOrder(organizationId: number, actorUserId: number, input: { orderNumber?: string; supplierId?: number; currencyCode: string; baseCurrencyCode: string; exchangeRateUsed?: number; expectedAt?: Date; lines: PurchaseOrderLineInput[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db.transaction(async tx => {
    if (input.supplierId) {
      const supplier = await tx.select().from(businessParties).where(and(eq(businessParties.id, input.supplierId), eq(businessParties.organizationId, organizationId))).limit(1);
      if (!supplier[0] || supplier[0].status !== "active" || !supplier[0].types.includes("supplier")) throw new Error("المورد المحدد غير متاح ضمن المؤسسة الحالية.");
    }
    const normalizedLines: Array<{ productId: number; warehouseId: number; quantity: number; unit: string; unitCost: number; lineTotal: number }> = [];
    for (const line of input.lines) {
      const product = await tx.select().from(products).where(and(eq(products.id, line.productId), eq(products.organizationId, organizationId))).limit(1);
      const warehouse = await tx.select().from(warehouses).where(and(eq(warehouses.id, line.warehouseId), eq(warehouses.organizationId, organizationId), eq(warehouses.status, "active"))).limit(1);
      if (!product[0] || product[0].status !== "active") throw new Error("أحد منتجات أمر الشراء غير متاح ضمن المؤسسة الحالية.");
      if (!warehouse[0]) throw new Error("مخزن أحد أسطر أمر الشراء غير متاح ضمن المؤسسة الحالية.");
      normalizedLines.push({ productId: line.productId, warehouseId: line.warehouseId, quantity: line.quantity, unit: line.unit?.trim() || product[0].purchaseUnit, unitCost: line.unitCost, lineTotal: roundMoney(line.quantity * line.unitCost) });
    }
    const grandTotal = roundMoney(normalizedLines.reduce((total, line) => total + line.lineTotal, 0));
    const inserted = await tx.insert(purchaseOrders).values({ organizationId, supplierId: input.supplierId, orderNumber: input.orderNumber?.trim() || newDocumentNumber("PO"), status: "draft", currencyCode: input.currencyCode, baseCurrencyCode: input.baseCurrencyCode, exchangeRateUsed: String(input.exchangeRateUsed ?? 1), grandTotal: String(grandTotal), expectedAt: input.expectedAt });
    const purchaseOrderId = Number(inserted[0].insertId);
    await tx.insert(purchaseOrderItems).values(normalizedLines.map(line => ({ organizationId, purchaseOrderId, productId: line.productId, warehouseId: line.warehouseId, orderedQuantity: String(line.quantity), receivedQuantity: "0", unit: line.unit, unitCost: String(line.unitCost), lineTotal: String(line.lineTotal) })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "purchase_order.created", entityType: "purchase_order", entityId: String(purchaseOrderId), metadata: { lines: normalizedLines.length, grandTotal } });
    return { id: purchaseOrderId, status: "draft" as const, grandTotal };
  });
}

export async function sendPurchaseOrder(organizationId: number, actorUserId: number, purchaseOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const order = await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.organizationId, organizationId))).limit(1);
    if (!order[0]) throw new Error("أمر الشراء غير متاح ضمن المؤسسة الحالية.");
    if (!canTransitionPurchaseDocument(order[0].status, "sent")) throw new Error("لا يمكن إرسال أمر الشراء من حالته الحالية.");
    await tx.update(purchaseOrders).set({ status: "sent" }).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "purchase_order.sent", entityType: "purchase_order", entityId: String(purchaseOrderId), metadata: null });
    return { id: purchaseOrderId, status: "sent" as const };
  });
}

export async function receivePurchaseOrder(organizationId: number, actorUserId: number, purchaseOrderId: number, receipts: Array<{ purchaseOrderItemId: number; quantity: number; lotNumber: string; cost?: number; manufacturingDate?: Date; expiryDate?: Date }>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db.transaction(async tx => {
    const order = await tx.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.organizationId, organizationId))).limit(1);
    if (!order[0] || !["sent", "partial"].includes(order[0].status)) throw new Error("لا يمكن استلام هذا الأمر من حالته الحالية.");
    const itemIds = new Set<number>();
    for (const receipt of receipts) {
      if (itemIds.has(receipt.purchaseOrderItemId)) throw new Error("لا يمكن تكرار سطر أمر الشراء في عملية استلام واحدة.");
      itemIds.add(receipt.purchaseOrderItemId);
      const item = await tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.id, receipt.purchaseOrderItemId), eq(purchaseOrderItems.organizationId, organizationId), eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))).limit(1);
      if (!item[0]) throw new Error("أحد أسطر الاستلام غير متاح ضمن أمر الشراء الحالي.");
      const remaining = Number(item[0].orderedQuantity) - Number(item[0].receivedQuantity);
      if (receipt.quantity > remaining) throw new Error("كمية الاستلام تتجاوز الكمية المتبقية في أمر الشراء.");
      const duplicateBatch = await tx.select({ id: productBatches.id }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, item[0].warehouseId), eq(productBatches.lotNumber, receipt.lotNumber))).limit(1);
      if (duplicateBatch[0]) throw new Error("رقم الدفعة مستخدم مسبقاً في المخزن المحدد.");
      const batch = await tx.insert(productBatches).values({ organizationId, productId: item[0].productId, warehouseId: item[0].warehouseId, lotNumber: receipt.lotNumber, sourcePartyId: order[0].supplierId, receivedQuantity: String(receipt.quantity), currentQuantity: String(receipt.quantity), reservedQuantity: "0", cost: String(receipt.cost ?? Number(item[0].unitCost)), manufacturingDate: receipt.manufacturingDate, expiryDate: receipt.expiryDate, status: "active" });
      const batchId = Number(batch[0].insertId);
      await tx.update(purchaseOrderItems).set({ receivedQuantity: sql`${purchaseOrderItems.receivedQuantity} + ${receipt.quantity}` }).where(and(eq(purchaseOrderItems.id, item[0].id), eq(purchaseOrderItems.organizationId, organizationId)));
      await tx.insert(stockMovements).values({ organizationId, warehouseId: item[0].warehouseId, productId: item[0].productId, batchId, movementType: "purchase_receipt", quantity: String(receipt.quantity), unit: item[0].unit, sourceDocumentType: "purchase_order", sourceDocumentId: purchaseOrderId, occurredAt: new Date(), actorUserId, auditReference: `PO-${purchaseOrderId}` });
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: item[0].warehouseId, productId: item[0].productId, quantity: String(receipt.quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${receipt.quantity}` } });
    }
    const updatedItems = await tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, organizationId), eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId)));
    const nextStatus = updatedItems.every(item => Number(item.receivedQuantity) >= Number(item.orderedQuantity)) ? "received" : "partial";
    if (!canTransitionPurchaseDocument(order[0].status, nextStatus)) throw new Error("انتقال حالة الاستلام غير مسموح.");
    await tx.update(purchaseOrders).set({ status: nextStatus }).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "purchase_order.received", entityType: "purchase_order", entityId: String(purchaseOrderId), metadata: { receipts: receipts.length, status: nextStatus } });
    return { id: purchaseOrderId, status: nextStatus };
  });
}

export async function updateProductBatchStatus(organizationId: number, actorUserId: number, batchId: number, status: "active" | "blocked" | "quarantined") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.update(productBatches).set({ status }).where(and(eq(productBatches.id, batchId), eq(productBatches.organizationId, organizationId)));
  if (!Number(result[0]?.affectedRows ?? 0)) throw new Error("الدفعة غير متاحة ضمن المؤسسة الحالية.");
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "product_batch.status_updated", entityType: "product_batch", entityId: String(batchId), metadata: { status } });
  return { id: batchId, status };
}

export async function adjustProductBatchQuantity(organizationId: number, actorUserId: number, batchId: number, quantity: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (quantity === 0) throw new Error("كمية التسوية لا يمكن أن تكون صفراً.");

  return db.transaction(async tx => {
    const batch = await tx.select().from(productBatches).where(and(eq(productBatches.id, batchId), eq(productBatches.organizationId, organizationId))).limit(1);
    if (!batch[0]) throw new Error("الدفعة غير متاحة ضمن المؤسسة الحالية.");
    if (batch[0].status === "expired") throw new Error("لا يمكن تسوية كمية دفعة منتهية.");
    const product = await tx.select({ baseUnit: products.baseUnit }).from(products).where(and(eq(products.id, batch[0].productId), eq(products.organizationId, organizationId))).limit(1);
    if (!product[0]) throw new Error("منتج الدفعة غير متاح ضمن المؤسسة الحالية.");
    if (Number(batch[0].currentQuantity) + quantity < Number(batch[0].reservedQuantity)) throw new Error("لا يمكن خفض كمية الدفعة تحت الكمية المحجوزة.");
    const updateResult = await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} + ${quantity}` }).where(and(eq(productBatches.id, batchId), eq(productBatches.organizationId, organizationId), sql`${productBatches.currentQuantity} + ${quantity} >= ${productBatches.reservedQuantity}`));
    if (!Number(updateResult[0]?.affectedRows ?? 0)) throw new Error("تعذر تسوية كمية الدفعة بأمان؛ يرجى إعادة المحاولة.");
    const movement = await tx.insert(stockMovements).values({ organizationId, warehouseId: batch[0].warehouseId, productId: batch[0].productId, batchId, movementType: "adjustment", quantity: String(quantity), unit: product[0].baseUnit, sourceDocumentType: "product_batch_adjustment", sourceDocumentId: batchId, occurredAt: new Date(), actorUserId, auditReference: `BAT-ADJ-${batchId}` });
    await tx.insert(inventoryBalances).values({ organizationId, warehouseId: batch[0].warehouseId, productId: batch[0].productId, quantity: String(quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${quantity}` } });
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "product_batch.quantity_adjusted", entityType: "product_batch", entityId: String(batchId), metadata: { quantity, reason: reason?.trim() || null } });
    return { id: batchId, quantity, stockMovementId: Number(movement[0].insertId) };
  });
}

export type StockTransferLineInput = { productId: number; batchId: number; quantity: number };

export async function createStockTransfer(organizationId: number, actorUserId: number, input: { transferNumber?: string; sourceWarehouseId: number; destinationWarehouseId: number; notes?: string; lines: StockTransferLineInput[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (input.sourceWarehouseId === input.destinationWarehouseId) throw new Error("يجب أن يختلف مخزن المصدر عن مخزن الوجهة.");
  return db.transaction(async tx => {
    const locations = await tx.select().from(warehouses).where(and(eq(warehouses.organizationId, organizationId), sql`${warehouses.id} in (${input.sourceWarehouseId}, ${input.destinationWarehouseId})`, eq(warehouses.status, "active")));
    if (locations.length !== 2) throw new Error("أحد مخازن التحويل غير متاح ضمن المؤسسة الحالية.");
    for (const line of input.lines) {
      const batch = await tx.select().from(productBatches).where(and(eq(productBatches.id, line.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.productId, line.productId), eq(productBatches.warehouseId, input.sourceWarehouseId))).limit(1);
      if (!batch[0] || batch[0].status !== "active" || Number(batch[0].currentQuantity) - Number(batch[0].reservedQuantity) < line.quantity) throw new Error("إحدى دفعات التحويل غير صالحة أو لا تحتوي الكمية المطلوبة.");
    }
    const inserted = await tx.insert(stockTransfers).values({ organizationId, transferNumber: input.transferNumber?.trim() || newDocumentNumber("TRF"), sourceWarehouseId: input.sourceWarehouseId, destinationWarehouseId: input.destinationWarehouseId, status: "draft", notes: input.notes?.trim(), createdByUserId: actorUserId });
    const transferId = Number(inserted[0].insertId);
    await tx.insert(stockTransferItems).values(input.lines.map(line => ({ organizationId, transferId, productId: line.productId, batchId: line.batchId, requestedQuantity: String(line.quantity), receivedQuantity: "0" })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "stock_transfer.created", entityType: "stock_transfer", entityId: String(transferId), metadata: { lines: input.lines.length, sourceWarehouseId: input.sourceWarehouseId, destinationWarehouseId: input.destinationWarehouseId } });
    return { id: transferId, status: "draft" as const };
  });
}

export async function approveStockTransfer(organizationId: number, actorUserId: number, transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.update(stockTransfers).set({ status: "approved", approvedByUserId: actorUserId }).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.organizationId, organizationId), eq(stockTransfers.status, "draft")));
  if (!Number(result[0]?.affectedRows ?? 0)) throw new Error("لا يمكن اعتماد التحويل من حالته الحالية.");
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "stock_transfer.approved", entityType: "stock_transfer", entityId: String(transferId), metadata: null });
  return { id: transferId, status: "approved" as const };
}

export async function dispatchStockTransfer(organizationId: number, actorUserId: number, transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const transfer = await tx.select().from(stockTransfers).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.organizationId, organizationId))).limit(1);
    if (!transfer[0] || transfer[0].status !== "approved") throw new Error("لا يمكن إرسال التحويل من حالته الحالية.");
    const items = await tx.select().from(stockTransferItems).where(and(eq(stockTransferItems.organizationId, organizationId), eq(stockTransferItems.transferId, transferId)));
    for (const item of items) {
      if (!item.batchId) throw new Error("يتطلب التحويل تحديد دفعة مصدر لكل سطر.");
      const batch = await tx.select().from(productBatches).where(and(eq(productBatches.id, item.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, transfer[0].sourceWarehouseId), eq(productBatches.productId, item.productId))).limit(1);
      if (!batch[0] || batch[0].status !== "active") throw new Error("دفعة مصدر التحويل غير صالحة.");
      const moved = Number(item.requestedQuantity);
      const updated = await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} - ${moved}` }).where(and(eq(productBatches.id, item.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.status, "active"), sql`${productBatches.currentQuantity} - ${productBatches.reservedQuantity} >= ${moved}`));
      if (!Number(updated[0]?.affectedRows ?? 0)) throw new Error("تعذر حجز كمية تحويل الدفعة بأمان؛ يرجى إعادة المحاولة.");
      await tx.insert(stockMovements).values({ organizationId, warehouseId: transfer[0].sourceWarehouseId, productId: item.productId, batchId: item.batchId, movementType: "transfer_out", quantity: String(-moved), unit: "قطعة", sourceDocumentType: "stock_transfer", sourceDocumentId: transferId, occurredAt: new Date(), actorUserId, auditReference: `TRF-${transferId}` });
      const total = await tx.select({ quantity: sql<string>`coalesce(sum(${productBatches.currentQuantity}), 0)` }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.productId, item.productId), eq(productBatches.warehouseId, transfer[0].sourceWarehouseId)));
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: transfer[0].sourceWarehouseId, productId: item.productId, quantity: String(total[0]?.quantity ?? 0), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: String(total[0]?.quantity ?? 0) } });
    }
    await tx.update(stockTransfers).set({ status: "in_transit", sentAt: new Date() }).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "stock_transfer.dispatched", entityType: "stock_transfer", entityId: String(transferId), metadata: { items: items.length } });
    return { id: transferId, status: "in_transit" as const };
  });
}

export async function receiveStockTransfer(organizationId: number, actorUserId: number, transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const transfer = await tx.select().from(stockTransfers).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.organizationId, organizationId))).limit(1);
    if (!transfer[0] || transfer[0].status !== "in_transit") throw new Error("لا يمكن استلام التحويل من حالته الحالية.");
    const items = await tx.select().from(stockTransferItems).where(and(eq(stockTransferItems.organizationId, organizationId), eq(stockTransferItems.transferId, transferId)));
    for (const item of items) {
      const sourceBatch = await tx.select().from(productBatches).where(and(eq(productBatches.id, item.batchId!), eq(productBatches.organizationId, organizationId))).limit(1);
      if (!sourceBatch[0]) throw new Error("لا يمكن العثور على دفعة مصدر التحويل.");
      const duplicate = await tx.select({ id: productBatches.id }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, transfer[0].destinationWarehouseId), eq(productBatches.lotNumber, sourceBatch[0].lotNumber))).limit(1);
      if (duplicate[0]) throw new Error("رقم الدفعة موجود بالفعل في مخزن الوجهة.");
      const quantity = Number(item.requestedQuantity);
      const destinationBatch = await tx.insert(productBatches).values({ organizationId, productId: item.productId, warehouseId: transfer[0].destinationWarehouseId, lotNumber: sourceBatch[0].lotNumber, sourcePartyId: sourceBatch[0].sourcePartyId, receivedQuantity: String(quantity), currentQuantity: String(quantity), reservedQuantity: "0", cost: sourceBatch[0].cost, manufacturingDate: sourceBatch[0].manufacturingDate, expiryDate: sourceBatch[0].expiryDate, status: sourceBatch[0].status === "active" ? "active" : "quarantined" });
      const destinationBatchId = Number(destinationBatch[0].insertId);
      await tx.update(stockTransferItems).set({ receivedQuantity: String(quantity) }).where(and(eq(stockTransferItems.id, item.id), eq(stockTransferItems.organizationId, organizationId)));
      await tx.insert(stockMovements).values({ organizationId, warehouseId: transfer[0].destinationWarehouseId, productId: item.productId, batchId: destinationBatchId, movementType: "transfer_in", quantity: String(quantity), unit: "قطعة", sourceDocumentType: "stock_transfer", sourceDocumentId: transferId, occurredAt: new Date(), actorUserId, auditReference: `TRF-${transferId}` });
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: transfer[0].destinationWarehouseId, productId: item.productId, quantity: String(quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${quantity}` } });
    }
    await tx.update(stockTransfers).set({ status: "received", receivedAt: new Date() }).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "stock_transfer.received", entityType: "stock_transfer", entityId: String(transferId), metadata: { items: items.length } });
    return { id: transferId, status: "received" as const };
  });
}

export async function listStockTransfersForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(stockTransfers).where(eq(stockTransfers.organizationId, organizationId)).orderBy(desc(stockTransfers.updatedAt), desc(stockTransfers.id)).limit(100);
}

export async function createInventoryCount(organizationId: number, actorUserId: number, input: { countNumber?: string; warehouseId: number; scope?: "full" | "partial" | "category" | "product" | "location"; movementMode?: "freeze" | "reconcile" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const warehouse = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.organizationId, organizationId), eq(warehouses.status, "active"))).limit(1);
  if (!warehouse[0]) throw new Error("مخزن الجرد غير متاح ضمن المؤسسة الحالية.");
  const created = await db.insert(inventoryCounts).values({ organizationId, countNumber: input.countNumber?.trim() || newDocumentNumber("CNT"), warehouseId: input.warehouseId, scope: input.scope ?? "partial", movementMode: input.movementMode ?? "reconcile", status: "draft", responsibleUserId: actorUserId });
  const countId = Number(created[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "inventory_count.created", entityType: "inventory_count", entityId: String(countId), metadata: { warehouseId: input.warehouseId } });
  return { id: countId, status: "draft" as const };
}

export async function startInventoryCount(organizationId: number, actorUserId: number, countId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const countRecord = await db.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.organizationId, organizationId))).limit(1);
  if (!countRecord[0] || !canTransitionStockCount(countRecord[0].status, "in_progress")) throw new Error("لا يمكن بدء الجرد من حالته الحالية.");
  await db.update(inventoryCounts).set({ status: "in_progress", startedAt: new Date() }).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.organizationId, organizationId)));
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "inventory_count.started", entityType: "inventory_count", entityId: String(countId), metadata: null });
  return { id: countId, status: "in_progress" as const };
}

export async function submitInventoryCount(organizationId: number, actorUserId: number, countId: number, items: Array<{ productId: number; batchId: number; actualQuantity: number }>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const countRecord = await tx.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.organizationId, organizationId))).limit(1);
    if (!countRecord[0] || !canTransitionStockCount(countRecord[0].status, "review")) throw new Error("لا يمكن إرسال الجرد للمراجعة من حالته الحالية.");
    const seen = new Set<number>();
    for (const item of items) {
      if (seen.has(item.batchId)) throw new Error("لا يمكن تكرار دفعة في مستند جرد واحد.");
      seen.add(item.batchId);
      const batch = await tx.select().from(productBatches).where(and(eq(productBatches.id, item.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.productId, item.productId), eq(productBatches.warehouseId, countRecord[0].warehouseId))).limit(1);
      if (!batch[0]) throw new Error("إحدى دفعات الجرد غير متاحة ضمن مخزن الجرد.");
      await tx.insert(inventoryCountItems).values({ organizationId, countId, productId: item.productId, batchId: item.batchId, expectedQuantity: batch[0].currentQuantity, actualQuantity: String(item.actualQuantity) });
    }
    await tx.update(inventoryCounts).set({ status: "review", reviewedByUserId: actorUserId }).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "inventory_count.submitted_for_review", entityType: "inventory_count", entityId: String(countId), metadata: { items: items.length } });
    return { id: countId, status: "review" as const };
  });
}

export async function approveInventoryCount(organizationId: number, actorUserId: number, countId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const countRecord = await tx.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.organizationId, organizationId))).limit(1);
    if (!countRecord[0] || !canTransitionStockCount(countRecord[0].status, "approved")) throw new Error("لا يمكن اعتماد الجرد من حالته الحالية.");
    const items = await tx.select().from(inventoryCountItems).where(and(eq(inventoryCountItems.organizationId, organizationId), eq(inventoryCountItems.countId, countId)));
    if (!items.length) throw new Error("لا يمكن اعتماد جرد بلا بنود.");
    for (const item of items) {
      if (!item.batchId || item.actualQuantity === null) throw new Error("تتطلب تسوية الجرد كمية فعلية ودفعة محددة.");
      const delta = Number(item.actualQuantity) - Number(item.expectedQuantity);
      if (delta === 0) continue;
      const batch = await tx.select().from(productBatches).where(and(eq(productBatches.id, item.batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, countRecord[0].warehouseId), eq(productBatches.productId, item.productId))).limit(1);
      if (!batch[0] || Number(batch[0].currentQuantity) + delta < Number(batch[0].reservedQuantity)) throw new Error("تسوية أحد بنود الجرد تخفض الدفعة تحت الكمية المحجوزة.");
      await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} + ${delta}` }).where(and(eq(productBatches.id, item.batchId), eq(productBatches.organizationId, organizationId), sql`${productBatches.currentQuantity} + ${delta} >= ${productBatches.reservedQuantity}`));
      await tx.insert(stockMovements).values({ organizationId, warehouseId: countRecord[0].warehouseId, productId: item.productId, batchId: item.batchId, movementType: "count_adjustment", quantity: String(delta), unit: "قطعة", sourceDocumentType: "inventory_count", sourceDocumentId: countId, occurredAt: new Date(), actorUserId, auditReference: `CNT-${countId}` });
      const total = await tx.select({ quantity: sql<string>`coalesce(sum(${productBatches.currentQuantity}), 0)` }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.productId, item.productId), eq(productBatches.warehouseId, countRecord[0].warehouseId)));
      await tx.insert(inventoryBalances).values({ organizationId, warehouseId: countRecord[0].warehouseId, productId: item.productId, quantity: String(total[0]?.quantity ?? 0), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: String(total[0]?.quantity ?? 0) } });
    }
    await tx.update(inventoryCounts).set({ status: "approved", approvedAt: new Date(), approvedByUserId: actorUserId }).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "inventory_count.approved", entityType: "inventory_count", entityId: String(countId), metadata: { items: items.length } });
    return { id: countId, status: "approved" as const };
  });
}

export async function listInventoryCountsForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(inventoryCounts).where(eq(inventoryCounts.organizationId, organizationId)).orderBy(desc(inventoryCounts.createdAt), desc(inventoryCounts.id)).limit(100);
}

export async function recordStockMovement({ organizationId, warehouseId, productId, batchId, movementType, quantity, unit, actorUserId, sourceDocumentType, sourceDocumentId }: { organizationId: number; warehouseId: number; productId: number; batchId?: number; movementType: "purchase_receipt" | "sales_issue" | "sales_return" | "supplier_return" | "transfer_out" | "transfer_in" | "adjustment" | "opening_balance" | "count_adjustment" | "production_issue" | "production_return" | "production_output"; quantity: number; unit: string; actorUserId: number; sourceDocumentType?: string; sourceDocumentId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (quantity === 0) throw new Error("كمية الحركة لا يمكن أن تكون صفراً.");
  return db.transaction(async tx => {
    await tx.insert(stockMovements).values({ organizationId, warehouseId, productId, batchId, movementType, quantity: String(quantity), unit, actorUserId, sourceDocumentType, sourceDocumentId, auditReference: `STK-${Date.now()}` });
    await tx.insert(inventoryBalances).values({ organizationId, warehouseId, productId, quantity: String(quantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${quantity}` } });
    if (batchId) {
      const batch = await tx.select().from(productBatches).where(and(eq(productBatches.id, batchId), eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, warehouseId), eq(productBatches.productId, productId))).limit(1);
      if (!batch[0]) throw new Error("الدفعة غير متاحة ضمن نطاق المخزن والمنتج الحالي.");
      if (quantity < 0 && (batch[0].status !== "active" || (batch[0].expiryDate && batch[0].expiryDate <= new Date()) || Number(batch[0].currentQuantity) < Math.abs(quantity))) throw new Error("لا يمكن الصرف من دفعة محجوبة أو منتهية أو بكمية غير متاحة.");
      await tx.update(productBatches).set({ currentQuantity: sql`${productBatches.currentQuantity} + ${quantity}` }).where(eq(productBatches.id, batchId));
    }
    return { success: true } as const;
  });
}

export async function previewFefoAllocation(organizationId: number, warehouseId: number, productId: number, requestedQuantity: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (requestedQuantity <= 0) throw new Error("الكمية المطلوبة يجب أن تكون أكبر من صفر.");
  const batches = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, warehouseId), eq(productBatches.productId, productId), eq(productBatches.status, "active"), sql`(${productBatches.expiryDate} IS NULL OR ${productBatches.expiryDate} > now())`)).orderBy(asc(productBatches.expiryDate));
  let remaining = requestedQuantity;
  const allocations = batches.flatMap(batch => {
    const available = Number(batch.currentQuantity) - Number(batch.reservedQuantity);
    if (remaining <= 0 || available <= 0) return [];
    const quantity = Math.min(available, remaining);
    remaining -= quantity;
    return [{ batchId: batch.id, lotNumber: batch.lotNumber, expiryDate: batch.expiryDate, quantity }];
  });
  return { allocations, remainingQuantity: remaining };
}

export async function listProductBatchesForOrganization(organizationId: number, filters?: { productId?: number; warehouseId?: number; status?: "active" | "blocked" | "quarantined" | "expired" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const conditions = [eq(productBatches.organizationId, organizationId)];
  if (filters?.productId) conditions.push(eq(productBatches.productId, filters.productId));
  if (filters?.warehouseId) conditions.push(eq(productBatches.warehouseId, filters.warehouseId));
  if (filters?.status) conditions.push(eq(productBatches.status, filters.status));
  return db.select().from(productBatches).where(and(...conditions)).orderBy(asc(productBatches.expiryDate), desc(productBatches.createdAt)).limit(200);
}

export async function createProductBatch(organizationId: number, input: { productId: number; warehouseId: number; lotNumber: string; receivedQuantity: number; cost: number; sourcePartyId?: number; manufacturingDate?: Date; expiryDate?: Date; status?: "active" | "blocked" | "quarantined" | "expired"; movementType?: "opening_balance" | "production_output"; sourceDocumentType?: string; sourceDocumentId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.transaction(async tx => {
    const product = await tx.select({ id: products.id, baseUnit: products.baseUnit }).from(products).where(and(eq(products.id, input.productId), eq(products.organizationId, organizationId))).limit(1);
    const warehouse = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.organizationId, organizationId), eq(warehouses.status, "active"))).limit(1);
    if (!product[0] || !warehouse[0]) throw new Error("لا يمكن إنشاء دفعة لمنتج أو مخزن خارج نطاق المؤسسة الحالية.");
    const inserted = await tx.insert(productBatches).values({ organizationId, productId: input.productId, warehouseId: input.warehouseId, lotNumber: input.lotNumber, sourcePartyId: input.sourcePartyId, receivedQuantity: String(input.receivedQuantity), currentQuantity: String(input.receivedQuantity), reservedQuantity: "0", cost: String(input.cost), manufacturingDate: input.manufacturingDate, expiryDate: input.expiryDate, status: input.status ?? "active" });
    const batchId = Number(inserted[0].insertId);
    await tx.insert(stockMovements).values({ organizationId, warehouseId: input.warehouseId, productId: input.productId, batchId, movementType: input.movementType ?? "opening_balance", quantity: String(input.receivedQuantity), unit: product[0].baseUnit, sourceDocumentType: input.sourceDocumentType ?? "product_batch", sourceDocumentId: input.sourceDocumentId ?? batchId, occurredAt: new Date(), auditReference: `BAT-${batchId}` });
    await tx.insert(inventoryBalances).values({ organizationId, warehouseId: input.warehouseId, productId: input.productId, quantity: String(input.receivedQuantity), reservedQuantity: "0" }).onDuplicateKeyUpdate({ set: { quantity: sql`${inventoryBalances.quantity} + ${input.receivedQuantity}` } });
    return { id: batchId };
  });
  return result;
}

export async function listStockMovementsForOrganization(organizationId: number, filters?: { productId?: number; warehouseId?: number; movementType?: "purchase_receipt" | "sales_issue" | "sales_return" | "supplier_return" | "transfer_out" | "transfer_in" | "adjustment" | "opening_balance" | "count_adjustment" | "production_issue" | "production_return" | "production_output" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const conditions = [eq(stockMovements.organizationId, organizationId)];
  if (filters?.productId) conditions.push(eq(stockMovements.productId, filters.productId));
  if (filters?.warehouseId) conditions.push(eq(stockMovements.warehouseId, filters.warehouseId));
  if (filters?.movementType) conditions.push(eq(stockMovements.movementType, filters.movementType));
  return db.select().from(stockMovements).where(and(...conditions)).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id)).limit(200);
}

export async function issueStockByFefo({ organizationId, warehouseId, productId, quantity, unit, actorUserId, movementType = "sales_issue", sourceDocumentType, sourceDocumentId }: { organizationId: number; warehouseId: number; productId: number; quantity: number; unit: string; actorUserId: number; movementType?: "sales_issue" | "production_issue"; sourceDocumentType?: string; sourceDocumentId?: number }) {
  const allocation = await previewFefoAllocation(organizationId, warehouseId, productId, quantity);
  if (allocation.remainingQuantity > 0) throw new Error("لا توجد كميات صالحة كافية لتغطية الصرف وفق FEFO.");
  for (const item of allocation.allocations) {
    await recordStockMovement({ organizationId, warehouseId, productId, batchId: item.batchId, movementType, quantity: -item.quantity, unit, actorUserId, sourceDocumentType, sourceDocumentId });
  }
  return allocation;
}

export type OperationalModule = "inventory" | "sales" | "purchases" | "finance" | "hr";

export type OperationalRecord = {
  id: number;
  title: string;
  reference: string;
  status: string;
  amount: string;
  updatedAt: Date;
};

export async function listOperationalRecords(organizationId: number, module: OperationalModule): Promise<OperationalRecord[]> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  switch (module) {
    case "inventory": {
      const rows = await db.select().from(products).where(eq(products.organizationId, organizationId)).orderBy(desc(products.updatedAt)).limit(50);
      return rows.map(row => ({ id: row.id, title: row.name, reference: row.sku, status: row.status, amount: `${row.salePrice} ر.س`, updatedAt: row.updatedAt }));
    }
    case "sales": {
      const rows = await db.select().from(salesInvoices).where(eq(salesInvoices.organizationId, organizationId)).orderBy(desc(salesInvoices.updatedAt)).limit(50);
      return rows.map(row => ({ id: row.id, title: "فاتورة مبيعات", reference: row.invoiceNumber, status: row.status, amount: `${row.grandTotal} ر.س`, updatedAt: row.updatedAt }));
    }
    case "purchases": {
      const rows = await db.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId)).orderBy(desc(purchaseOrders.updatedAt)).limit(50);
      return rows.map(row => ({ id: row.id, title: "أمر شراء", reference: row.orderNumber, status: row.status, amount: `${row.grandTotal} ر.س`, updatedAt: row.updatedAt }));
    }
    case "finance": {
      const rows = await db.select().from(financialTransactions).where(eq(financialTransactions.organizationId, organizationId)).orderBy(desc(financialTransactions.occurredAt)).limit(50);
      return rows.map(row => ({ id: row.id, title: row.category, reference: row.type, status: "مسجل", amount: `${row.amount} ر.س`, updatedAt: row.occurredAt }));
    }
    case "hr": {
      const rows = await db.select().from(employees).where(eq(employees.organizationId, organizationId)).orderBy(desc(employees.updatedAt)).limit(50);
      return rows.map(row => ({ id: row.id, title: row.fullName, reference: row.employeeNumber, status: row.status, amount: row.jobTitle ?? "موظف", updatedAt: row.updatedAt }));
    }
  }
}

export async function createOperationalRecord({ organizationId, module, title, reference, amount, category }: { organizationId: number; module: OperationalModule; title: string; reference?: string; amount?: number; category?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const token = Date.now().toString().slice(-7);
  switch (module) {
    case "inventory": {
      const created = await db.insert(products).values({ organizationId, name: title, sku: reference?.trim() || `PRD-${token}`, salePrice: String(amount ?? 0), reorderPoint: "0", status: "active" });
      return { id: Number(created[0].insertId), label: "تمت إضافة الصنف." };
    }
    case "sales": {
      const created = await db.insert(salesInvoices).values({ organizationId, invoiceNumber: reference?.trim() || `INV-${token}`, grandTotal: String(amount ?? 0), amountPaid: "0", status: "issued", issuedAt: new Date() });
      return { id: Number(created[0].insertId), label: "تم إنشاء فاتورة المبيعات." };
    }
    case "purchases": {
      const created = await db.insert(purchaseOrders).values({ organizationId, orderNumber: reference?.trim() || `PO-${token}`, grandTotal: String(amount ?? 0), status: "draft" });
      return { id: Number(created[0].insertId), label: "تم إنشاء أمر الشراء." };
    }
    case "finance": {
      const created = await db.insert(financialTransactions).values({ organizationId, type: "expense", category: category?.trim() || title, amount: String(amount ?? 0), occurredAt: new Date() });
      return { id: Number(created[0].insertId), label: "تم تسجيل المعاملة المالية." };
    }
    case "hr": {
      const created = await db.insert(employees).values({ organizationId, fullName: title, employeeNumber: reference?.trim() || `EMP-${token}`, department: category?.trim() || null, jobTitle: "موظف", status: "active", joinedAt: new Date() });
      return { id: Number(created[0].insertId), label: "تمت إضافة الموظف." };
    }
  }
}

export async function getFinancialReportSummary(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [income, expenses, issuedInvoices, productCount] = await Promise.all([
    db.select({ value: sql<string>`coalesce(sum(${financialTransactions.amount}), 0)` }).from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.type, "income"), gte(financialTransactions.occurredAt, monthStart))),
    db.select({ value: sql<string>`coalesce(sum(${financialTransactions.amount}), 0)` }).from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.type, "expense"), gte(financialTransactions.occurredAt, monthStart))),
    db.select({ value: count() }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.status, "issued"))),
    db.select({ value: count() }).from(products).where(eq(products.organizationId, organizationId)),
  ]);
  const totalIncome = Number(income[0]?.value ?? 0);
  const totalExpenses = Number(expenses[0]?.value ?? 0);
  return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, issuedInvoices: Number(issuedInvoices[0]?.value ?? 0), products: Number(productCount[0]?.value ?? 0) };
}

export async function getCommerceReportSummary(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [invoiceRows, openPurchaseOrders, lowStockRows] = await Promise.all([
    db.select({
      openInvoices: sql<string>`coalesce(sum(case when ${salesInvoices.status} in ('issued', 'partial', 'overdue') then 1 else 0 end), 0)`,
      issuedValue: sql<string>`coalesce(sum(case when ${salesInvoices.status} in ('issued', 'partial', 'paid', 'overdue') then ${salesInvoices.grandTotal} else 0 end), 0)`,
    }).from(salesInvoices).where(eq(salesInvoices.organizationId, organizationId)),
    db.select({ value: count() }).from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, organizationId), sql`${purchaseOrders.status} in ('sent', 'partial')`)),
    db
      .select({ productId: products.id })
      .from(products)
      .leftJoin(inventoryBalances, and(eq(inventoryBalances.organizationId, products.organizationId), eq(inventoryBalances.productId, products.id)))
      .where(eq(products.organizationId, organizationId))
      .groupBy(products.id, products.reorderPoint)
      .having(sql`coalesce(sum(${inventoryBalances.quantity} - ${inventoryBalances.reservedQuantity}), 0) <= ${products.reorderPoint}`),
  ]);
  return {
    openInvoices: Number(invoiceRows[0]?.openInvoices ?? 0),
    issuedValue: Number(invoiceRows[0]?.issuedValue ?? 0),
    openPurchaseOrders: Number(openPurchaseOrders[0]?.value ?? 0),
    lowStockProducts: lowStockRows.length,
  };
}

export async function listNotificationsForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.organizationId, organizationId)).orderBy(desc(notifications.createdAt)).limit(30);
}

export async function createOperationalNotifications(organizationId: number, reasons: string[]) {
  const db = await getDb();
  if (!db || reasons.length === 0) return;
  const openAlerts = await db.select({ content: notifications.content }).from(notifications).where(and(eq(notifications.organizationId, organizationId), eq(notifications.type, "operational_alert"), eq(notifications.isRead, "no"))).limit(500);
  const knownContents = new Set(openAlerts.map(alert => alert.content));
  const newReasons = reasons.filter(reason => !knownContents.has(reason));
  if (newReasons.length) await db.insert(notifications).values(newReasons.map(content => ({ organizationId, type: "operational_alert", severity: "warning" as const, title: "تنبيه تشغيلي", content, isRead: "no" as const })));
}

export async function markNotificationRead(organizationId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(notifications).set({ isRead: "yes" }).where(and(eq(notifications.id, notificationId), eq(notifications.organizationId, organizationId)));
}

export async function markAllNotificationsRead(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.update(notifications).set({ isRead: "yes" }).where(and(eq(notifications.organizationId, organizationId), eq(notifications.isRead, "no")));
  return { updated: Number(result[0]?.affectedRows ?? 0) };
}

export async function getDashboardMetrics(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [productCount, employeeCount, invoiceCount, stock, unreadNotifications, overdue, lowStockRows, monthlyExpenses, budgetRecord] = await Promise.all([
    db.select({ value: count() }).from(products).where(eq(products.organizationId, organizationId)),
    db.select({ value: count() }).from(employees).where(eq(employees.organizationId, organizationId)),
    db.select({ value: count() }).from(salesInvoices).where(eq(salesInvoices.organizationId, organizationId)),
    db.select({ value: sql<string>`coalesce(sum(${inventoryBalances.quantity} - ${inventoryBalances.reservedQuantity}), 0)` }).from(inventoryBalances).where(eq(inventoryBalances.organizationId, organizationId)),
    db.select({ value: count() }).from(notifications).where(and(eq(notifications.organizationId, organizationId), eq(notifications.isRead, "no"))),
    db.select({ value: count() }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.status, "overdue"))),
    db
      .select({ productId: products.id })
      .from(products)
      .leftJoin(inventoryBalances, and(eq(inventoryBalances.organizationId, products.organizationId), eq(inventoryBalances.productId, products.id)))
      .where(eq(products.organizationId, organizationId))
      .groupBy(products.id, products.reorderPoint)
      .having(sql`coalesce(sum(${inventoryBalances.quantity} - ${inventoryBalances.reservedQuantity}), 0) <= ${products.reorderPoint}`),
    db
      .select({ value: sql<string>`coalesce(sum(${financialTransactions.amount}), 0)` })
      .from(financialTransactions)
      .where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.type, "expense"), gte(financialTransactions.occurredAt, monthStart))),
    db.select({ monthlyBudget: organizations.monthlyBudget }).from(organizations).where(eq(organizations.id, organizationId)).limit(1),
  ]);

  const currentMonthExpenses = Number(monthlyExpenses[0]?.value ?? 0);
  const monthlyBudget = Number(budgetRecord[0]?.monthlyBudget ?? 0);

  return {
    products: Number(productCount[0]?.value ?? 0),
    employees: Number(employeeCount[0]?.value ?? 0),
    invoices: Number(invoiceCount[0]?.value ?? 0),
    stockOnHand: Number(stock[0]?.value ?? 0),
    unreadNotifications: Number(unreadNotifications[0]?.value ?? 0),
    overdueInvoices: Number(overdue[0]?.value ?? 0),
    lowStockProducts: lowStockRows.length,
    currentMonthExpenses,
    monthlyBudget,
    budgetExceeded: monthlyBudget > 0 && currentMonthExpenses > monthlyBudget,
    updatedAt: new Date().toISOString(),
  };
}
