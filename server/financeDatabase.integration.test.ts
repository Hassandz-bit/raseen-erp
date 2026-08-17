import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { organizations, auditLogs } from "../drizzle/schema";
import { accountingJournals, accountingMappings, chartOfAccounts, fiscalPeriods, fiscalYears, journalEntries, journalLines } from "../drizzle/financeSchema";
import { changeFiscalPeriodStatus, createFiscalPeriod, createFiscalYear, createJournalEntry, getAccountBalance, listChartOfAccounts, listFinanceSetup, postJournalEntry, reverseJournalEntry, seedDefaultChartOfAccounts } from "./finance";
import { getBalanceSheetReport, getCashFlowReport, getGeneralLedgerReport, getProfitAndLossReport, getTrialBalanceReport } from "./financialReports";
import { getDb } from "./db";

let organizationIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const organizationId of organizationIds) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
    await db.delete(journalLines).where(eq(journalLines.organizationId, organizationId));
    await db.delete(journalEntries).where(eq(journalEntries.organizationId, organizationId));
    await db.delete(accountingMappings).where(eq(accountingMappings.organizationId, organizationId));
    await db.delete(fiscalPeriods).where(eq(fiscalPeriods.organizationId, organizationId));
    await db.delete(fiscalYears).where(eq(fiscalYears.organizationId, organizationId));
    await db.delete(accountingJournals).where(eq(accountingJournals.organizationId, organizationId));
    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  organizationIds = [];
});

async function createFinanceFixture() {
  const db = await getDb();
  expect(db).toBeTruthy();
  if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const organization = await db.insert(organizations).values({ name: `اختبار مالية ${suffix}`, slug: `finance-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
  const organizationId = Number(organization[0].insertId);
  organizationIds.push(organizationId);
  await seedDefaultChartOfAccounts(organizationId);
  const year = await createFiscalYear(organizationId, { name: `FY-${suffix}`, startsAt: new Date("2026-01-01T00:00:00.000Z"), endsAt: new Date("2026-12-31T23:59:59.999Z") });
  const period = await createFiscalPeriod(organizationId, { fiscalYearId: year.id, name: `AUG-${suffix}`, startsAt: new Date("2026-08-01T00:00:00.000Z"), endsAt: new Date("2026-08-31T23:59:59.999Z") });
  const accounts = await listChartOfAccounts(organizationId);
  const setup = await listFinanceSetup(organizationId);
  const cash = accounts.find(account => account.code === "1001");
  const capital = accounts.find(account => account.code === "3100");
  const generalJournal = setup.journals.find(journal => journal.code === "GENERAL");
  if (!cash || !capital || !generalJournal) throw new Error("لم تكتمل تهيئة نواة المالية الافتراضية.");
  return { db, organizationId, periodId: period.id, cashId: cash.id, capitalId: capital.id, journalId: generalJournal.id };
}

describe("تكامل نواة المالية", () => {
  it("ينشئ ويرحل ويعكس قيداً متوازناً ويمنع تكرار مصدر الحدث", async () => {
    const { organizationId, periodId, cashId, capitalId, journalId } = await createFinanceFixture();
    const entry = await createJournalEntry(organizationId, 1, { journalId, fiscalPeriodId: periodId, entryDate: new Date("2026-08-17T12:00:00.000Z"), currencyCode: "SAR", sourceModule: "integration", sourceDocumentType: "opening_capital", sourceDocumentId: 1, lines: [
      { accountId: cashId, debit: 1000, credit: 0 },
      { accountId: capitalId, debit: 0, credit: 1000 },
    ] });
    await expect(postJournalEntry(organizationId, 1, entry.id)).resolves.toMatchObject({ status: "posted" });
    await expect(createJournalEntry(organizationId, 1, { journalId, fiscalPeriodId: periodId, entryDate: new Date("2026-08-17T12:00:00.000Z"), currencyCode: "SAR", sourceModule: "integration", sourceDocumentType: "opening_capital", sourceDocumentId: 1, lines: [{ accountId: cashId, debit: 1, credit: 0 }, { accountId: capitalId, debit: 0, credit: 1 }] })).rejects.toThrow("قيد محاسبي سابق");
    expect(await getAccountBalance(organizationId, cashId)).toMatchObject({ debit: 1000, credit: 0, net: 1000 });
    await expect(reverseJournalEntry(organizationId, 1, entry.id, periodId, "عكس اختبار", new Date("2026-08-18T12:00:00.000Z"))).resolves.toMatchObject({ sourceId: entry.id, status: "posted" });
    expect(await getAccountBalance(organizationId, cashId)).toMatchObject({ debit: 1000, credit: 1000, net: 0 });
  });

  it("يمنع ترحيل القيد في فترة مغلقة ولا يسرّب رصيد الحساب لمؤسسة أخرى", async () => {
    const { db, organizationId, periodId, cashId, capitalId, journalId } = await createFinanceFixture();
    const entry = await createJournalEntry(organizationId, 1, { journalId, fiscalPeriodId: periodId, entryDate: new Date("2026-08-17T12:00:00.000Z"), currencyCode: "SAR", lines: [{ accountId: cashId, debit: 50, credit: 0 }, { accountId: capitalId, debit: 0, credit: 50 }] });
    await db.update(fiscalPeriods).set({ status: "closed" }).where(and(eq(fiscalPeriods.id, periodId), eq(fiscalPeriods.organizationId, organizationId)));
    await expect(postJournalEntry(organizationId, 1, entry.id)).rejects.toThrow("مغلقة");
    const other = await db.insert(organizations).values({ name: "مؤسسة مالية معزولة", slug: `finance-isolated-${Date.now()}-${Math.random()}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    const otherOrganizationId = Number(other[0].insertId);
    organizationIds.push(otherOrganizationId);
    expect(await getAccountBalance(otherOrganizationId, cashId)).toMatchObject({ debit: 0, credit: 0, net: 0 });
  });

  it("يبني تقارير الأستاذ وميزان المراجعة والقوائم من القيود المرحّلة ويدقق إقفال الفترة", async () => {
    const { organizationId, periodId, cashId, capitalId, journalId } = await createFinanceFixture();
    const accounts = await listChartOfAccounts(organizationId);
    const revenue = accounts.find(account => account.code === "4100");
    const cogs = accounts.find(account => account.code === "5100");
    const inventory = accounts.find(account => account.code === "1200");
    if (!revenue || !cogs || !inventory) throw new Error("لم تكتمل حسابات التقارير الافتراضية.");
    const date = new Date("2026-08-17T12:00:00.000Z");
    const opening = await createJournalEntry(organizationId, 1, { journalId, fiscalPeriodId: periodId, entryDate: date, currencyCode: "SAR", lines: [{ accountId: cashId, debit: 1000, credit: 0 }, { accountId: capitalId, debit: 0, credit: 1000 }] });
    const sale = await createJournalEntry(organizationId, 1, { journalId, fiscalPeriodId: periodId, entryDate: date, currencyCode: "SAR", lines: [{ accountId: cashId, debit: 500, credit: 0 }, { accountId: revenue.id, debit: 0, credit: 500 }, { accountId: cogs.id, debit: 200, credit: 0 }, { accountId: inventory.id, debit: 0, credit: 200 }] });
    await postJournalEntry(organizationId, 1, opening.id);
    await postJournalEntry(organizationId, 1, sale.id);
    const [ledger, trial, profitAndLoss, balanceSheet, cashFlow] = await Promise.all([getGeneralLedgerReport(organizationId), getTrialBalanceReport(organizationId), getProfitAndLossReport(organizationId), getBalanceSheetReport(organizationId), getCashFlowReport(organizationId)]);
    expect(ledger).toHaveLength(6);
    expect(trial.totals).toMatchObject({ debit: 1700, credit: 1700 });
    expect(profitAndLoss).toMatchObject({ revenue: 500, cogs: 200, grossProfit: 300, netProfit: 300 });
    expect(balanceSheet.totals.equationDifference).toBe(0);
    expect(cashFlow).toMatchObject({ inflow: 1500, outflow: 0, netCashFlow: 1500 });
    await expect(changeFiscalPeriodStatus(organizationId, 1, periodId, "closed", "إقفال اختبار الشهر")).resolves.toMatchObject({ status: "closed" });
    await expect(changeFiscalPeriodStatus(organizationId, 1, periodId, "open", "إعادة فتح مصرح بها")).resolves.toMatchObject({ status: "open" });
  });
});
