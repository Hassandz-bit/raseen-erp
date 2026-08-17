import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLogs, organizations } from "../drizzle/schema";
import { accountingJournals, accountingMappings, budgetLines, budgets, chartOfAccounts, costCenters, fiscalPeriods, fiscalYears, journalEntries, journalLines } from "../drizzle/financeSchema";
import { createFiscalPeriod, createFiscalYear, createJournalEntry, listChartOfAccounts, listFinanceSetup, postJournalEntry, seedDefaultChartOfAccounts } from "./finance";
import { approveBudget, createBudget, createCostCenter, getBudgetVsActual, upsertBudgetLine } from "./financePlanning";
import { getDb } from "./db";

let organizationId: number | null = null;
afterEach(async () => { if (!organizationId) return; const db = await getDb(); if (!db) return; const id = organizationId; await db.delete(auditLogs).where(eq(auditLogs.organizationId, id)); await db.delete(budgetLines).where(eq(budgetLines.organizationId, id)); await db.delete(budgets).where(eq(budgets.organizationId, id)); await db.delete(costCenters).where(eq(costCenters.organizationId, id)); await db.delete(journalLines).where(eq(journalLines.organizationId, id)); await db.delete(journalEntries).where(eq(journalEntries.organizationId, id)); await db.delete(accountingMappings).where(eq(accountingMappings.organizationId, id)); await db.delete(fiscalPeriods).where(eq(fiscalPeriods.organizationId, id)); await db.delete(fiscalYears).where(eq(fiscalYears.organizationId, id)); await db.delete(accountingJournals).where(eq(accountingJournals.organizationId, id)); await db.delete(chartOfAccounts).where(eq(chartOfAccounts.organizationId, id)); await db.delete(organizations).where(eq(organizations.id, id)); organizationId = null; });

describe("تكامل التخطيط المالي", () => {
  it("يقارن الميزانية بالفعلي من القيود المرحّلة ولا يسمح بتعديلها بعد الاعتماد", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`; const organization = await db.insert(organizations).values({ name: `تخطيط ${suffix}`, slug: `planning-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" }); organizationId = Number(organization[0].insertId);
    await seedDefaultChartOfAccounts(organizationId); const year = await createFiscalYear(organizationId, { name: `FY-${suffix}`, startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: new Date("2026-12-31T23:59:59Z") }); const period = await createFiscalPeriod(organizationId, { fiscalYearId: year.id, name: `AUG-${suffix}`, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-31T23:59:59Z") });
    const accounts = await listChartOfAccounts(organizationId); const expense = accounts.find(row => row.code === "5200"); const cash = accounts.find(row => row.code === "1001"); const general = (await listFinanceSetup(organizationId)).journals.find(row => row.code === "GENERAL"); if (!expense || !cash || !general) throw new Error("تهيئة المالية غير مكتملة.");
    const costCenter = await createCostCenter(organizationId, 1, { code: "DIST", name: "التوزيع", dimensions: { vehicleId: 7 } }); const budget = await createBudget(organizationId, 1, { fiscalYearId: year.id, name: "ميزانية تشغيل" }); await upsertBudgetLine(organizationId, 1, { budgetId: budget.id, accountId: expense.id, fiscalPeriodId: period.id, amount: 1000, costCenterId: costCenter.id });
    const entry = await createJournalEntry(organizationId, 1, { journalId: general.id, fiscalPeriodId: period.id, entryDate: new Date("2026-08-17T12:00:00Z"), currencyCode: "SAR", lines: [{ accountId: expense.id, debit: 250, credit: 0, costCenterId: costCenter.id }, { accountId: cash.id, debit: 0, credit: 250, costCenterId: costCenter.id }] }); await postJournalEntry(organizationId, 1, entry.id);
    const comparison = await getBudgetVsActual(organizationId, budget.id); expect(comparison.totals).toMatchObject({ budget: 1000, actual: 250, variance: 750 }); await approveBudget(organizationId, 1, budget.id); await expect(upsertBudgetLine(organizationId, 1, { budgetId: budget.id, accountId: expense.id, fiscalPeriodId: period.id, amount: 900, costCenterId: costCenter.id })).rejects.toThrow("غير مسودة");
  });
});
