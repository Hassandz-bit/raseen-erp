import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { storagePut } from "./storage";

export const ORGANIZATION_BACKUP_FORMAT = "raseen.organization-backup" as const;
export const ORGANIZATION_BACKUP_VERSION = 1 as const;
export const MAX_ORGANIZATION_BACKUP_BYTES = 48 * 1024 * 1024;

/**
 * These tables contain organization-scoped operational data. Identity, memberships,
 * subscriptions, audit history, idempotency keys, and technical notifications are
 * intentionally excluded so a local recovery cannot grant access or overwrite billing.
 */
export const ORGANIZATION_BACKUP_TABLES = [
  "organization_settings", "organization_currencies", "organization_exchange_rates", "organization_roles",
  "branches", "business_parties", "product_categories", "product_brands", "products", "product_unit_conversions", "price_lists", "price_list_items", "warehouses", "product_batches", "inventory_balances", "stock_movements", "stock_transfers", "stock_transfer_items", "inventory_counts", "inventory_count_items",
  "purchase_orders", "purchase_order_items", "sales_orders", "sales_order_items", "sales_order_item_packaging_refs", "sales_invoices", "sales_invoice_items",
  "distribution_settings", "distribution_territories", "fleet_vehicles", "fleet_vehicle_documents", "fleet_maintenance_records", "fleet_fuel_logs", "fleet_gps_records", "vehicle_load_orders", "vehicle_load_items", "distribution_routes", "distribution_route_stops", "distribution_deliveries", "distribution_delivery_items", "distribution_delivery_proofs", "distribution_returns", "distribution_collections", "distribution_route_closings", "distribution_route_expenses", "distribution_geofence_events",
  "b2b_retailer_outlets", "b2b_retailer_orders", "b2b_retailer_order_items", "b2b_order_adjustments", "b2b_order_item_packaging_refs", "b2b_order_reviews", "b2b_retailer_return_requests", "b2b_promotions", "b2b_promotion_packaging_targets", "b2b_saved_order_lists", "b2b_saved_order_list_items",
  "manufacturing_product_profiles", "production_lines", "manufacturing_boms", "manufacturing_bom_items", "production_orders", "production_material_reservations", "production_outputs", "production_quality_checks", "production_stages", "production_expenses",
  "chart_of_accounts", "accounting_mappings", "fiscal_years", "fiscal_periods", "journal_entries", "journal_lines", "accounting_journals", "financial_transactions", "bank_accounts", "bank_movements", "cashboxes", "cashbox_movements", "cash_transfers", "bank_reconciliations", "bank_reconciliation_lines", "cash_reconciliations", "cost_centers", "budgets", "budget_lines", "payable_payments",
  "hr_departments", "hr_positions", "work_schedules", "employees", "employee_profiles", "employee_contracts", "leave_types", "leave_balances", "leave_requests", "attendance_records", "attendance_details", "overtime_entries", "allowance_types", "employee_allowances", "employee_advances", "commission_rules", "commission_entries", "payroll_periods", "payroll_runs", "payroll_run_employees", "payslips", "payroll_adjustments",
] as const;

const EXPORT_TABLES = ORGANIZATION_BACKUP_TABLES;

const EXCLUDED_SCOPES = [
  "حسابات المستخدمين وعضويات المؤسسة وصلاحيات الجلسات", "الاشتراك والفوترة المركزية وحزم المؤسسة", "سجل التدقيق والإشعارات والمفاتيح التقنية", "بايتات الملفات في التخزين؛ تحتفظ الحزمة بروابط الملفات فقط عندما تكون محفوظة ضمن سجلات التشغيل",
] as const;

const moduleGroups: Record<string, readonly string[]> = {
  foundation: ["organization_settings", "organization_currencies", "organization_exchange_rates", "organization_roles", "branches", "business_parties", "product_categories", "product_brands", "products", "product_unit_conversions", "price_lists", "price_list_items", "warehouses"],
  inventory: ["product_batches", "inventory_balances", "stock_movements", "stock_transfers", "stock_transfer_items", "inventory_counts", "inventory_count_items"],
  commerce: ["purchase_orders", "purchase_order_items", "sales_orders", "sales_order_items", "sales_order_item_packaging_refs", "sales_invoices", "sales_invoice_items"],
  distribution: ["distribution_settings", "distribution_territories", "fleet_vehicles", "fleet_vehicle_documents", "fleet_maintenance_records", "fleet_fuel_logs", "fleet_gps_records", "vehicle_load_orders", "vehicle_load_items", "distribution_routes", "distribution_route_stops", "distribution_deliveries", "distribution_delivery_items", "distribution_delivery_proofs", "distribution_returns", "distribution_collections", "distribution_route_closings", "distribution_route_expenses", "distribution_geofence_events"],
  merchant: ["b2b_retailer_outlets", "b2b_retailer_orders", "b2b_retailer_order_items", "b2b_order_adjustments", "b2b_order_item_packaging_refs", "b2b_order_reviews", "b2b_retailer_return_requests", "b2b_promotions", "b2b_promotion_packaging_targets", "b2b_saved_order_lists", "b2b_saved_order_list_items"],
  manufacturing: ["manufacturing_product_profiles", "production_lines", "manufacturing_boms", "manufacturing_bom_items", "production_orders", "production_material_reservations", "production_outputs", "production_quality_checks", "production_stages", "production_expenses"],
  finance: ["chart_of_accounts", "accounting_mappings", "fiscal_years", "fiscal_periods", "journal_entries", "journal_lines", "accounting_journals", "financial_transactions", "bank_accounts", "bank_movements", "cashboxes", "cashbox_movements", "cash_transfers", "bank_reconciliations", "bank_reconciliation_lines", "cash_reconciliations", "cost_centers", "budgets", "budget_lines", "payable_payments"],
  hr: ["hr_departments", "hr_positions", "work_schedules", "employees", "employee_profiles", "employee_contracts", "leave_types", "leave_balances", "leave_requests", "attendance_records", "attendance_details", "overtime_entries", "allowance_types", "employee_allowances", "employee_advances", "commission_rules", "commission_entries", "payroll_periods", "payroll_runs", "payroll_run_employees", "payslips", "payroll_adjustments"],
};

type BackupRow = Record<string, unknown>;
type BackupData = Record<string, BackupRow[]>;

const backupSchema = z.object({
  format: z.literal(ORGANIZATION_BACKUP_FORMAT),
  version: z.literal(ORGANIZATION_BACKUP_VERSION),
  payload: z.object({
    createdAt: z.string().datetime(),
    source: z.object({ organizationId: z.number().int().positive(), organizationName: z.string().min(1).max(180), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
    data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
    rowCounts: z.record(z.string(), z.number().int().nonnegative()),
  }),
  integrity: z.object({ algorithm: z.literal("SHA-256"), checksum: z.string().regex(/^[a-f0-9]{64}$/) }),
});

export type OrganizationBackupEnvelope = z.infer<typeof backupSchema>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function checksum(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function organizationFingerprint(organizationId: number, slug: string): string {
  return checksum({ organizationId, slug });
}

export function createOrganizationBackupEnvelope(payload: OrganizationBackupEnvelope["payload"]): OrganizationBackupEnvelope {
  return { format: ORGANIZATION_BACKUP_FORMAT, version: ORGANIZATION_BACKUP_VERSION, payload, integrity: { algorithm: "SHA-256", checksum: checksum(payload) } };
}

function portable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { __raseenBinary: value.toString("base64") };
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as BackupRow).map(([key, item]) => [key, portable(item)]));
  return value;
}

function scrubGlobalIdentity(row: BackupRow, organizationId: number): BackupRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (/UserId$/.test(key)) return [key, null];
    if (key === "organizationId") return [key, organizationId];
    return [key, portable(value)];
  }));
}

function readRows(result: unknown): BackupRow[] {
  return ((result as [BackupRow[]])[0] ?? []).map(row => ({ ...row }));
}

function assertTableSet(data: BackupData, rowCounts: Record<string, number>) {
  const allowed = new Set<string>(EXPORT_TABLES);
  for (const table of Object.keys(data)) if (!allowed.has(table)) throw new Error("تتضمن النسخة جدولاً غير مسموح به.");
  for (const table of EXPORT_TABLES) {
    if (!Array.isArray(data[table])) throw new Error(`النسخة لا تحتوي جدول ${table}.`);
    if (rowCounts[table] !== data[table].length) throw new Error(`عدد سجلات ${table} لا يطابق محتوى النسخة.`);
  }
}

function moduleCounts(rowCounts: Record<string, number>) {
  return Object.fromEntries(Object.entries(moduleGroups).map(([module, tables]) => [module, tables.reduce((total, table) => total + (rowCounts[table] ?? 0), 0)]));
}

function databaseValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && "__raseenBinary" in (value as BackupRow)) return Buffer.from(String((value as BackupRow).__raseenBinary), "base64");
  return typeof value === "object" ? JSON.stringify(value) : value;
}

function buildInsert(table: string, row: BackupRow) {
  const entries = Object.entries(row).filter(([column]) => /^[A-Za-z][A-Za-z0-9_]*$/.test(column));
  if (!entries.length) throw new Error(`لا يمكن استعادة سجل فارغ من ${table}.`);
  const columns = sql.join(entries.map(([column]) => sql.raw(`\`${column}\``)), sql.raw(", "));
  const values = sql.join(entries.map(([, value]) => sql`${databaseValue(value)}`), sql.raw(", "));
  return sql`INSERT INTO ${sql.raw(`\`${table}\``)} (${columns}) VALUES (${values})`;
}

async function readCurrentOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.execute(sql.raw(`SELECT id, name, slug FROM \`organizations\` WHERE \`id\` = ${organizationId} LIMIT 1`));
  const organization = readRows(result)[0] as { id?: number; name?: string; slug?: string } | undefined;
  if (!organization?.id || !organization.name || !organization.slug) throw new Error("تعذر تحديد المؤسسة الحالية.");
  return { id: Number(organization.id), name: organization.name, slug: organization.slug };
}

export async function createOrganizationBackup(organizationId: number): Promise<OrganizationBackupEnvelope> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const organization = await readCurrentOrganization(organizationId);
  const data: BackupData = {};
  for (const table of EXPORT_TABLES) {
    const result = await db.execute(sql.raw(`SELECT * FROM \`${table}\` WHERE \`organizationId\` = ${organizationId}`));
    data[table] = readRows(result).map(row => scrubGlobalIdentity(row, organizationId));
  }
  const rowCounts = Object.fromEntries(EXPORT_TABLES.map(table => [table, data[table].length]));
  const payload = { createdAt: new Date().toISOString(), source: { organizationId, organizationName: organization.name, fingerprint: organizationFingerprint(organizationId, organization.slug) }, data, rowCounts };
  return createOrganizationBackupEnvelope(payload);
}

export function parseOrganizationBackup(serialized: string): OrganizationBackupEnvelope {
  if (Buffer.byteLength(serialized, "utf8") > MAX_ORGANIZATION_BACKUP_BYTES) throw new Error("حجم ملف النسخة يتجاوز الحد الآمن المدعوم.");
  let raw: unknown;
  try { raw = JSON.parse(serialized); } catch { throw new Error("ملف النسخة ليس JSON صالحاً."); }
  const envelope = backupSchema.parse(raw);
  assertTableSet(envelope.payload.data, envelope.payload.rowCounts);
  if (checksum(envelope.payload) !== envelope.integrity.checksum) throw new Error("فشل تحقق SHA-256؛ قد يكون الملف تالفاً أو عُدّل.");
  return envelope;
}

export async function previewOrganizationBackup(serialized: string, targetOrganizationId: number) {
  const bundle = parseOrganizationBackup(serialized);
  const target = await readCurrentOrganization(targetOrganizationId);
  const sourceMatchesTarget = bundle.payload.source.organizationId === target.id && bundle.payload.source.fingerprint === organizationFingerprint(target.id, target.slug);
  return {
    valid: true as const,
    compatible: sourceMatchesTarget,
    format: bundle.format,
    version: bundle.version,
    createdAt: bundle.payload.createdAt,
    source: bundle.payload.source,
    checksum: bundle.integrity.checksum,
    rowCounts: bundle.payload.rowCounts,
    moduleCounts: moduleCounts(bundle.payload.rowCounts),
    excludedScopes: EXCLUDED_SCOPES,
  };
}

async function recordRecoveryEvent(organizationId: number, actorUserId: number, action: "safety_snapshot_created" | "restore_completed" | "restore_failed", backupChecksum: string, snapshotKey: string | null, summary: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  await db.execute(sql`INSERT INTO \`organization_recovery_events\` (\`organizationId\`, \`action\`, \`backupChecksum\`, \`snapshotKey\`, \`summary\`, \`actorUserId\`) VALUES (${organizationId}, ${action}, ${backupChecksum}, ${snapshotKey}, ${JSON.stringify(summary)}, ${actorUserId})`);
}

export async function listOrganizationRecoveryEvents(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.execute(sql.raw(`SELECT id, action, backupChecksum, summary, createdAt FROM \`organization_recovery_events\` WHERE \`organizationId\` = ${organizationId} ORDER BY \`createdAt\` DESC LIMIT 8`));
  return readRows(result).map(row => ({
    id: Number(row.id),
    action: String(row.action),
    backupChecksum: String(row.backupChecksum),
    summary: portable(row.summary),
    createdAt: portable(row.createdAt),
  }));
}

export async function restoreOrganizationBackup(serialized: string, targetOrganizationId: number, actorUserId: number, confirmation: string) {
  if (confirmation !== "استئناف من النسخة" && confirmation !== "Reprendre depuis la sauvegarde" && confirmation !== "Resume from backup") throw new Error("عبارة تأكيد الاستعادة غير صحيحة.");
  const bundle = parseOrganizationBackup(serialized);
  const preview = await previewOrganizationBackup(serialized, targetOrganizationId);
  if (!preview.compatible) throw new Error("هذه النسخة تخص مؤسسة أخرى أو أن بصمة المؤسسة الحالية لا تطابقها.");
  const before = await createOrganizationBackup(targetOrganizationId);
  const safetyKey = `organization-recovery/${targetOrganizationId}/${Date.now()}-${before.integrity.checksum}.json`;
  const safetySnapshot = await storagePut(safetyKey, JSON.stringify(before), "application/json");
  await recordRecoveryEvent(targetOrganizationId, actorUserId, "safety_snapshot_created", bundle.integrity.checksum, safetySnapshot.key, { priorChecksum: before.integrity.checksum, restoredRows: Object.values(bundle.payload.rowCounts).reduce((total, count) => total + count, 0) });

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  try {
    await db.transaction(async transaction => {
      for (const table of [...EXPORT_TABLES].reverse()) await transaction.execute(sql.raw(`DELETE FROM \`${table}\` WHERE \`organizationId\` = ${targetOrganizationId}`));
      for (const table of EXPORT_TABLES) {
        for (const sourceRow of bundle.payload.data[table]) {
          const row = scrubGlobalIdentity(sourceRow, targetOrganizationId);
          await transaction.execute(buildInsert(table, row));
        }
      }
    });
    await recordRecoveryEvent(targetOrganizationId, actorUserId, "restore_completed", bundle.integrity.checksum, safetySnapshot.key, { restoredAt: new Date().toISOString(), rowCounts: bundle.payload.rowCounts });
    return { restored: true as const, checksum: bundle.integrity.checksum, restoredRows: Object.values(bundle.payload.rowCounts).reduce((total, count) => total + count, 0) };
  } catch (error) {
    await recordRecoveryEvent(targetOrganizationId, actorUserId, "restore_failed", bundle.integrity.checksum, safetySnapshot.key, { message: error instanceof Error ? error.message : "Unknown restore error" });
    throw error;
  }
}

export function getOrganizationBackupFilename(organizationName: string, createdAt: string) {
  const safeName = organizationName.trim().replace(/[^a-zA-Z0-9_\u0600-\u06ff-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "organization";
  return `raseen-backup-${safeName}-${createdAt.slice(0, 10)}.json`;
}
