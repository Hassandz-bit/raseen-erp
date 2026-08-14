import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  employees,
  businessParties,
  financialTransactions,
  InsertUser,
  inventoryBalances,
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
  purchaseOrders,
  salesInvoices,
  stockMovements,
  userPreferences,
  users,
} from "../drizzle/schema";
import { getCurrencyCatalogEntry } from "../shared/currencyCatalog";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export const defaultDocumentSettings = {
  paperSize: "A4" as const,
  headerText: "",
  footerText: "",
  showSignature: true,
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
  if (values.baseCurrencyCode === values.quoteCurrencyCode) throw new Error("يجب أن تختلف عملة الأساس عن عملة الاقتباس.");
  const result = await db.insert(organizationExchangeRates).values({ organizationId, baseCurrencyCode: values.baseCurrencyCode, quoteCurrencyCode: values.quoteCurrencyCode, rate: String(values.rate), effectiveAt: values.effectiveAt, source: values.source?.trim() || "manual", createdByUserId: userId });
  return { id: Number(result[0].insertId) };
}

export async function createOrganizationForUser({ userId, name }: { userId: number; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const slug = `org-${userId}-${Date.now()}`;
  const moduleKeys = ["inventory", "sales", "purchases", "finance", "hr", "reports", "ai_assistant"];

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
  const row = await db
    .select({ organization: organizations, membership: organizationMemberships })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.status, "active"), eq(organizations.status, "active")))
    .orderBy(desc(organizationMemberships.updatedAt))
    .limit(1);
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
  const result = await db.insert(products).values({ organizationId, sku: values.sku, name: values.name, nameAr: values.nameAr, nameFr: values.nameFr, nameEn: values.nameEn, barcode: values.barcode, categoryId: values.categoryId, brandId: values.brandId, productType: values.productType, baseUnit: values.baseUnit, unit: values.baseUnit, purchaseUnit: values.purchaseUnit, salesUnit: values.salesUnit, unitsPerCarton: String(values.unitsPerCarton), purchasePrice: String(values.purchasePrice), salePrice: String(values.salePrice), taxRate: String(values.taxRate), minimumStock: String(values.minimumStock), reorderPoint: String(values.reorderPoint), description: values.description, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function createBusinessParty(organizationId: number, input: { name: string; types: string[]; code?: string; contactName?: string; phone?: string; email?: string; paymentTermsDays?: number; creditLimit?: number; preferredCurrencyCode?: string; customerSegment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(businessParties).values({ organizationId, name: input.name, types: input.types, code: input.code, contactName: input.contactName, phone: input.phone, email: input.email, paymentTermsDays: input.paymentTermsDays ?? 0, creditLimit: String(input.creditLimit ?? 0), preferredCurrencyCode: input.preferredCurrencyCode, customerSegment: input.customerSegment, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function recordStockMovement({ organizationId, warehouseId, productId, batchId, movementType, quantity, unit, actorUserId, sourceDocumentType, sourceDocumentId }: { organizationId: number; warehouseId: number; productId: number; batchId?: number; movementType: "purchase_receipt" | "sales_issue" | "sales_return" | "supplier_return" | "transfer_out" | "transfer_in" | "adjustment" | "opening_balance" | "count_adjustment"; quantity: number; unit: string; actorUserId: number; sourceDocumentType?: string; sourceDocumentId?: number }) {
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

export async function createProductBatch(organizationId: number, input: { productId: number; warehouseId: number; lotNumber: string; receivedQuantity: number; cost: number; sourcePartyId?: number; manufacturingDate?: Date; expiryDate?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(productBatches).values({ organizationId, productId: input.productId, warehouseId: input.warehouseId, lotNumber: input.lotNumber, sourcePartyId: input.sourcePartyId, receivedQuantity: String(input.receivedQuantity), currentQuantity: String(input.receivedQuantity), reservedQuantity: "0", cost: String(input.cost), manufacturingDate: input.manufacturingDate, expiryDate: input.expiryDate, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function listStockMovementsForOrganization(organizationId: number, filters?: { productId?: number; warehouseId?: number; movementType?: "purchase_receipt" | "sales_issue" | "sales_return" | "supplier_return" | "transfer_out" | "transfer_in" | "adjustment" | "opening_balance" | "count_adjustment" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const conditions = [eq(stockMovements.organizationId, organizationId)];
  if (filters?.productId) conditions.push(eq(stockMovements.productId, filters.productId));
  if (filters?.warehouseId) conditions.push(eq(stockMovements.warehouseId, filters.warehouseId));
  if (filters?.movementType) conditions.push(eq(stockMovements.movementType, filters.movementType));
  return db.select().from(stockMovements).where(and(...conditions)).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id)).limit(200);
}

export async function issueStockByFefo({ organizationId, warehouseId, productId, quantity, unit, actorUserId, sourceDocumentType, sourceDocumentId }: { organizationId: number; warehouseId: number; productId: number; quantity: number; unit: string; actorUserId: number; sourceDocumentType?: string; sourceDocumentId?: number }) {
  const allocation = await previewFefoAllocation(organizationId, warehouseId, productId, quantity);
  if (allocation.remainingQuantity > 0) throw new Error("لا توجد كميات صالحة كافية لتغطية الصرف وفق FEFO.");
  for (const item of allocation.allocations) {
    await recordStockMovement({ organizationId, warehouseId, productId, batchId: item.batchId, movementType: "sales_issue", quantity: -item.quantity, unit, actorUserId, sourceDocumentType, sourceDocumentId });
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

export async function listNotificationsForOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.organizationId, organizationId)).orderBy(desc(notifications.createdAt)).limit(30);
}

export async function createOperationalNotifications(organizationId: number, reasons: string[]) {
  const db = await getDb();
  if (!db || reasons.length === 0) return;
  await db.insert(notifications).values(reasons.map(content => ({ organizationId, type: "operational_alert", severity: "warning" as const, title: "تنبيه تشغيلي", content, isRead: "no" as const })));
}

export async function markNotificationRead(organizationId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.update(notifications).set({ isRead: "yes" }).where(and(eq(notifications.id, notificationId), eq(notifications.organizationId, organizationId)));
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
