import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  employees,
  financialTransactions,
  InsertUser,
  inventoryBalances,
  notifications,
  organizationMemberships,
  organizationModules,
  organizationRoles,
  organizations,
  products,
  salesInvoices,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
