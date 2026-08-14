import {
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const userPreferences = mysqlTable(
  "user_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    language: mysqlEnum("language", ["ar", "fr", "en"]).default("ar").notNull(),
    themeMode: mysqlEnum("themeMode", ["light", "dark", "system"]).default("system").notNull(),
    sidebarMode: mysqlEnum("sidebarMode", ["expanded", "compact", "collapsed"]).default("expanded").notNull(),
    density: mysqlEnum("density", ["comfortable", "compact"]).default("comfortable").notNull(),
    fontFamily: varchar("fontFamily", { length: 64 }).default("ibm-plex").notNull(),
    fontScale: mysqlEnum("fontScale", ["small", "normal", "large", "extra_large"]).default("normal").notNull(),
    numeralStyle: mysqlEnum("numeralStyle", ["western", "arabic_indic"]).default("western").notNull(),
    accentColor: varchar("accentColor", { length: 16 }).default("gold").notNull(),
    radiusPreset: mysqlEnum("radiusPreset", ["soft", "rounded", "sharp"]).default("rounded").notNull(),
    moduleViewMode: mysqlEnum("moduleViewMode", ["classic", "nawa_flow"]).default("classic").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("user_preferences_user_unique").on(table.userId)],
);

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "suspended", "trial"]).default("trial").notNull(),
  baseCurrency: varchar("baseCurrency", { length: 8 }).default("SAR").notNull(),
  locale: varchar("locale", { length: 12 }).default("ar-SA").notNull(),
  monthlyBudget: decimal("monthlyBudget", { precision: 15, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const organizationSettings = mysqlTable(
  "organization_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    currencyCode: varchar("currencyCode", { length: 8 }).default("SAR").notNull(),
    currencySymbolPosition: mysqlEnum("currencySymbolPosition", ["before", "after"]).default("after").notNull(),
    decimalPlaces: int("decimalPlaces").default(2).notNull(),
    dateFormat: varchar("dateFormat", { length: 24 }).default("DD/MM/YYYY").notNull(),
    timeFormat: mysqlEnum("timeFormat", ["12h", "24h"]).default("24h").notNull(),
    timeZone: varchar("timeZone", { length: 64 }).default("Africa/Algiers").notNull(),
    firstDayOfWeek: mysqlEnum("firstDayOfWeek", ["monday", "sunday", "saturday"]).default("monday").notNull(),
    decimalSeparator: mysqlEnum("decimalSeparator", ["dot", "comma"]).default("dot").notNull(),
    thousandsSeparator: mysqlEnum("thousandsSeparator", ["comma", "dot", "space"]).default("comma").notNull(),
    documentSettings: json("documentSettings").$type<{ paperSize: "A4" | "A5" | "thermal"; logoUrl?: string; address?: string; phone?: string; legalInfo?: string; headerText?: string; footerText?: string; showSignature?: boolean; fontFamily?: "ibm-plex" | "tajawal" | "noto-arabic" | "inter" | "system"; fontSize?: "small" | "normal" | "large" }>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("organization_settings_organization_unique").on(table.organizationId)],
);

export const organizationCurrencies = mysqlTable(
  "organization_currencies",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    currencyCode: varchar("currencyCode", { length: 8 }).notNull(),
    symbol: varchar("symbol", { length: 16 }).notNull(),
    decimalPlaces: int("decimalPlaces").default(2).notNull(),
    displayStyle: mysqlEnum("displayStyle", ["symbol", "code", "symbol_and_code"]).default("symbol").notNull(),
    isBase: mysqlEnum("isBase", ["yes", "no"]).default("no").notNull(),
    status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("organization_currency_code_unique").on(table.organizationId, table.currencyCode), index("organization_currency_active_idx").on(table.organizationId, table.status)],
);

export const organizationExchangeRates = mysqlTable(
  "organization_exchange_rates",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    baseCurrencyCode: varchar("baseCurrencyCode", { length: 8 }).notNull(),
    quoteCurrencyCode: varchar("quoteCurrencyCode", { length: 8 }).notNull(),
    rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
    effectiveAt: timestamp("effectiveAt").notNull(),
    source: varchar("source", { length: 64 }).default("manual").notNull(),
    createdByUserId: int("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("exchange_rate_organization_pair_date_idx").on(table.organizationId, table.baseCurrencyCode, table.quoteCurrencyCode, table.effectiveAt)],
);

export const organizationMemberships = mysqlTable(
  "organization_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    roleKey: varchar("roleKey", { length: 48 }).default("member").notNull(),
    dataScope: json("dataScope").$type<{ branchIds?: number[]; warehouseIds?: number[]; regionIds?: number[] } | null>(),
    status: mysqlEnum("status", ["active", "invited", "suspended"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("membership_organization_user_unique").on(table.organizationId, table.userId),
    index("membership_user_idx").on(table.userId),
  ],
);

export const organizationRoles = mysqlTable(
  "organization_roles",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    key: varchar("key", { length: 48 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    permissions: json("permissions").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("organization_role_key_unique").on(table.organizationId, table.key)],
);

export const organizationModules = mysqlTable(
  "organization_modules",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    moduleKey: varchar("moduleKey", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["active", "suspended", "expired"]).default("active").notNull(),
    effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
    effectiveUntil: timestamp("effectiveUntil"),
    changedByUserId: int("changedByUserId"),
    changeSource: varchar("changeSource", { length: 80 }).default("manual").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("organization_module_unique").on(table.organizationId, table.moduleKey)],
);

export const businessParties = mysqlTable(
  "business_parties",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    types: json("types").$type<string[]>().notNull(),
    contactName: varchar("contactName", { length: 160 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    taxNumber: varchar("taxNumber", { length: 80 }),
    creditLimit: decimal("creditLimit", { precision: 15, scale: 2 }).default("0").notNull(),
    status: mysqlEnum("status", ["active", "inactive", "blocked"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("party_organization_idx").on(table.organizationId)],
);

export const productCategories = mysqlTable(
  "product_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    color: varchar("color", { length: 16 }).default("#D7B56D").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("category_organization_name_unique").on(table.organizationId, table.name)],
);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    categoryId: int("categoryId"),
    name: varchar("name", { length: 220 }).notNull(),
    sku: varchar("sku", { length: 96 }).notNull(),
    barcode: varchar("barcode", { length: 96 }),
    unit: varchar("unit", { length: 32 }).default("قطعة").notNull(),
    purchasePrice: decimal("purchasePrice", { precision: 15, scale: 2 }).default("0").notNull(),
    salePrice: decimal("salePrice", { precision: 15, scale: 2 }).default("0").notNull(),
    reorderPoint: decimal("reorderPoint", { precision: 15, scale: 3 }).default("0").notNull(),
    imageUrl: varchar("imageUrl", { length: 1024 }),
    status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("product_organization_sku_unique").on(table.organizationId, table.sku),
    index("product_organization_category_idx").on(table.organizationId, table.categoryId),
  ],
);

export const warehouses = mysqlTable(
  "warehouses",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    isMobile: mysqlEnum("isMobile", ["yes", "no"]).default("no").notNull(),
    status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("warehouse_organization_code_unique").on(table.organizationId, table.code)],
);

export const inventoryBalances = mysqlTable(
  "inventory_balances",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    productId: int("productId").notNull(),
    warehouseId: int("warehouseId").notNull(),
    quantity: decimal("quantity", { precision: 15, scale: 3 }).default("0").notNull(),
    reservedQuantity: decimal("reservedQuantity", { precision: 15, scale: 3 }).default("0").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("inventory_balance_unique").on(table.organizationId, table.productId, table.warehouseId),
    index("inventory_product_idx").on(table.organizationId, table.productId),
  ],
);

export const salesInvoices = mysqlTable(
  "sales_invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    customerId: int("customerId"),
    invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["draft", "issued", "partial", "paid", "overdue", "cancelled"]).default("draft").notNull(),
    grandTotal: decimal("grandTotal", { precision: 15, scale: 2 }).default("0").notNull(),
    amountPaid: decimal("amountPaid", { precision: 15, scale: 2 }).default("0").notNull(),
    dueDate: timestamp("dueDate"),
    issuedAt: timestamp("issuedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("invoice_organization_number_unique").on(table.organizationId, table.invoiceNumber),
    index("invoice_organization_status_idx").on(table.organizationId, table.status),
  ],
);

export const purchaseOrders = mysqlTable(
  "purchase_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    supplierId: int("supplierId"),
    orderNumber: varchar("orderNumber", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["draft", "sent", "partial", "received", "cancelled"]).default("draft").notNull(),
    grandTotal: decimal("grandTotal", { precision: 15, scale: 2 }).default("0").notNull(),
    expectedAt: timestamp("expectedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("purchase_order_organization_number_unique").on(table.organizationId, table.orderNumber),
    index("purchase_order_organization_status_idx").on(table.organizationId, table.status),
  ],
);

export const financialTransactions = mysqlTable(
  "financial_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    type: mysqlEnum("type", ["income", "expense", "transfer", "adjustment"]).notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    referenceType: varchar("referenceType", { length: 64 }),
    referenceId: int("referenceId"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("finance_organization_date_idx").on(table.organizationId, table.occurredAt)],
);

export const employees = mysqlTable(
  "employees",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    fullName: varchar("fullName", { length: 180 }).notNull(),
    employeeNumber: varchar("employeeNumber", { length: 64 }).notNull(),
    department: varchar("department", { length: 120 }),
    jobTitle: varchar("jobTitle", { length: 120 }),
    status: mysqlEnum("status", ["active", "leave", "inactive"]).default("active").notNull(),
    joinedAt: timestamp("joinedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("employee_organization_number_unique").on(table.organizationId, table.employeeNumber)],
);

export const attendanceRecords = mysqlTable(
  "attendance_records",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    employeeId: int("employeeId").notNull(),
    attendanceDate: timestamp("attendanceDate").notNull(),
    status: mysqlEnum("status", ["present", "absent", "leave", "late"]).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("attendance_employee_date_unique").on(table.organizationId, table.employeeId, table.attendanceDate),
    index("attendance_organization_date_idx").on(table.organizationId, table.attendanceDate),
  ],
);

export const payrollRuns = mysqlTable(
  "payroll_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    periodLabel: varchar("periodLabel", { length: 32 }).notNull(),
    status: mysqlEnum("status", ["draft", "approved", "paid"]).default("draft").notNull(),
    totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("payroll_organization_period_unique").on(table.organizationId, table.periodLabel)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    severity: mysqlEnum("severity", ["info", "success", "warning", "critical"]).default("info").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    content: text("content").notNull(),
    isRead: mysqlEnum("isRead", ["yes", "no"]).default("no").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notification_organization_read_idx").on(table.organizationId, table.isRead)],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    actorUserId: int("actorUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: varchar("entityId", { length: 80 }),
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_organization_created_idx").on(table.organizationId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
