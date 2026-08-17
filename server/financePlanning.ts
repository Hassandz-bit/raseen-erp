import { and, eq, inArray, isNull } from "drizzle-orm";
import { auditLogs } from "../drizzle/schema";
import { budgetLines, budgets, chartOfAccounts, costCenters, fiscalPeriods, fiscalYears, journalEntries, journalLines } from "../drizzle/financeSchema";
import { getDb } from "./db";

export async function createCostCenter(organizationId: number, actorUserId: number, input: { code: string; name: string; branchId?: number; dimensions?: Record<string, string | number | null> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(costCenters).values({ organizationId, code: input.code.trim(), name: input.name.trim(), branchId: input.branchId, dimensions: input.dimensions, status: "active" });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.cost_center_created", entityType: "cost_center", entityId: String(id), metadata: { code: input.code.trim(), branchId: input.branchId ?? null } });
  return { id };
}

export async function listCostCenters(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(costCenters).where(eq(costCenters.organizationId, organizationId));
}

export async function listBudgets(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(budgets).where(eq(budgets.organizationId, organizationId));
}

export async function createBudget(organizationId: number, actorUserId: number, input: { fiscalYearId: number; name: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [year] = await db.select({ id: fiscalYears.id }).from(fiscalYears).where(and(eq(fiscalYears.id, input.fiscalYearId), eq(fiscalYears.organizationId, organizationId))).limit(1);
  if (!year) throw new Error("السنة المالية غير موجودة ضمن المؤسسة الحالية.");
  const result = await db.insert(budgets).values({ organizationId, fiscalYearId: input.fiscalYearId, name: input.name.trim(), notes: input.notes?.trim(), status: "draft", createdByUserId: actorUserId });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.budget_created", entityType: "budget", entityId: String(id), metadata: { fiscalYearId: input.fiscalYearId } });
  return { id, status: "draft" as const };
}

export async function upsertBudgetLine(organizationId: number, actorUserId: number, input: { budgetId: number; accountId: number; fiscalPeriodId: number; amount: number; branchId?: number; costCenterId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, input.budgetId), eq(budgets.organizationId, organizationId))).limit(1);
  if (!budget || budget.status !== "draft") throw new Error("لا يمكن تعديل ميزانية غير مسودة ضمن المؤسسة الحالية.");
  const [[account], [period]] = await Promise.all([
    db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(eq(chartOfAccounts.id, input.accountId), eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.status, "active"))).limit(1),
    db.select({ id: fiscalPeriods.id, fiscalYearId: fiscalPeriods.fiscalYearId }).from(fiscalPeriods).where(and(eq(fiscalPeriods.id, input.fiscalPeriodId), eq(fiscalPeriods.organizationId, organizationId))).limit(1),
  ]);
  if (!account || !period || period.fiscalYearId !== budget.fiscalYearId) throw new Error("يجب أن يتبع حساب وسطر الفترة المؤسسة والسنة المالية الخاصة بالميزانية.");
  if (input.costCenterId) { const [center] = await db.select({ id: costCenters.id }).from(costCenters).where(and(eq(costCenters.id, input.costCenterId), eq(costCenters.organizationId, organizationId), eq(costCenters.status, "active"))).limit(1); if (!center) throw new Error("مركز التكلفة غير متاح ضمن المؤسسة."); }
  const conditions = [eq(budgetLines.organizationId, organizationId), eq(budgetLines.budgetId, input.budgetId), eq(budgetLines.accountId, input.accountId), eq(budgetLines.fiscalPeriodId, input.fiscalPeriodId), input.branchId ? eq(budgetLines.branchId, input.branchId) : isNull(budgetLines.branchId), input.costCenterId ? eq(budgetLines.costCenterId, input.costCenterId) : isNull(budgetLines.costCenterId)];
  const [existing] = await db.select({ id: budgetLines.id }).from(budgetLines).where(and(...conditions)).limit(1);
  if (existing) await db.update(budgetLines).set({ amount: String(input.amount) }).where(and(eq(budgetLines.id, existing.id), eq(budgetLines.organizationId, organizationId))); else await db.insert(budgetLines).values({ organizationId, budgetId: input.budgetId, accountId: input.accountId, fiscalPeriodId: input.fiscalPeriodId, amount: String(input.amount), branchId: input.branchId, costCenterId: input.costCenterId });
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.budget_line_saved", entityType: "budget", entityId: String(input.budgetId), metadata: { accountId: input.accountId, fiscalPeriodId: input.fiscalPeriodId, amount: input.amount } });
  return { budgetId: input.budgetId, updated: Boolean(existing) };
}

export async function approveBudget(organizationId: number, actorUserId: number, budgetId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.organizationId, organizationId))).limit(1);
  if (!budget || budget.status !== "draft") throw new Error("الميزانية غير متاحة للاعتماد ضمن المؤسسة الحالية.");
  await db.transaction(async tx => { await tx.update(budgets).set({ status: "approved", approvedByUserId: actorUserId, approvedAt: new Date() }).where(and(eq(budgets.id, budgetId), eq(budgets.organizationId, organizationId))); await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.budget_approved", entityType: "budget", entityId: String(budgetId), metadata: {} }); });
  return { id: budgetId, status: "approved" as const };
}

export async function getBudgetVsActual(organizationId: number, budgetId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.organizationId, organizationId))).limit(1);
  if (!budget) throw new Error("الميزانية غير موجودة ضمن المؤسسة الحالية.");
  const lines = await db.select({ line: budgetLines, account: chartOfAccounts }).from(budgetLines).innerJoin(chartOfAccounts, eq(chartOfAccounts.id, budgetLines.accountId)).where(and(eq(budgetLines.organizationId, organizationId), eq(budgetLines.budgetId, budgetId), eq(chartOfAccounts.organizationId, organizationId)));
  const periodIds = Array.from(new Set(lines.map(row => row.line.fiscalPeriodId)));
  if (!periodIds.length) return { budget, lines: [], totals: { budget: 0, actual: 0, variance: 0 } };
  const actualRows = await db.select({ accountId: journalLines.accountId, fiscalPeriodId: journalEntries.fiscalPeriodId, branchId: journalLines.branchId, costCenterId: journalLines.costCenterId, debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId)).where(and(eq(journalLines.organizationId, organizationId), eq(journalEntries.organizationId, organizationId), eq(journalEntries.status, "posted"), inArray(journalEntries.fiscalPeriodId, periodIds)));
  const comparison = lines.map(({ line, account }) => {
    const actual = actualRows.filter(row => row.accountId === line.accountId && row.fiscalPeriodId === line.fiscalPeriodId && (line.branchId === null || row.branchId === line.branchId) && (line.costCenterId === null || row.costCenterId === line.costCenterId)).reduce((sum, row) => sum + (["revenue", "liability", "equity"].includes(account.accountType) ? Number(row.credit) - Number(row.debit) : Number(row.debit) - Number(row.credit)), 0);
    return { ...line, accountCode: account.code, accountNameAr: account.nameAr, accountNameFr: account.nameFr, accountNameEn: account.nameEn, accountType: account.accountType, budgetAmount: Number(line.amount), actual, variance: Number(line.amount) - actual };
  });
  return { budget, lines: comparison, totals: comparison.reduce((total, line) => ({ budget: total.budget + line.budgetAmount, actual: total.actual + line.actual, variance: total.variance + line.variance }), { budget: 0, actual: 0, variance: 0 }) };
}
