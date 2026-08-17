import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { accountingJournals, chartOfAccounts, journalEntries, journalLines } from "../drizzle/financeSchema";
import { getDb } from "./db";

export type ReportRange = { startsAt?: Date; endsAt?: Date; accountId?: number };

async function postedLineRows(organizationId: number, input: ReportRange = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const predicates = [eq(journalLines.organizationId, organizationId), eq(journalEntries.organizationId, organizationId), eq(chartOfAccounts.organizationId, organizationId), inArray(journalEntries.status, ["posted"])];
  if (input.startsAt) predicates.push(gte(journalEntries.entryDate, input.startsAt));
  if (input.endsAt) predicates.push(lte(journalEntries.entryDate, input.endsAt));
  if (input.accountId) predicates.push(eq(journalLines.accountId, input.accountId));
  return db.select({ entryDate: journalEntries.entryDate, journalNumber: journalEntries.journalNumber, reference: journalEntries.reference, entryDescription: journalEntries.description, journalName: accountingJournals.name, accountId: chartOfAccounts.id, accountCode: chartOfAccounts.code, accountNameAr: chartOfAccounts.nameAr, accountNameFr: chartOfAccounts.nameFr, accountNameEn: chartOfAccounts.nameEn, accountType: chartOfAccounts.accountType, debit: journalLines.debit, credit: journalLines.credit, partyId: journalLines.partyId, branchId: journalLines.branchId, costCenterId: journalLines.costCenterId, lineDescription: journalLines.description }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId)).innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId)).innerJoin(accountingJournals, eq(accountingJournals.id, journalEntries.journalId)).where(and(...predicates)).orderBy(asc(journalEntries.entryDate), asc(journalEntries.id), asc(journalLines.id));
}

export async function getGeneralLedgerReport(organizationId: number, input: ReportRange = {}) {
  const rows = await postedLineRows(organizationId, input);
  const balances = new Map<number, number>();
  return rows.map(row => {
    const next = (balances.get(row.accountId) ?? 0) + Number(row.debit) - Number(row.credit);
    balances.set(row.accountId, next);
    return { ...row, debit: Number(row.debit), credit: Number(row.credit), balance: next };
  });
}

export async function getTrialBalanceReport(organizationId: number, input: ReportRange = {}) {
  const rows = await postedLineRows(organizationId, input);
  const grouped = new Map<number, { accountId: number; code: string; nameAr: string; nameFr: string; nameEn: string; accountType: string; debit: number; credit: number }>();
  rows.forEach(row => {
    const existing = grouped.get(row.accountId) ?? { accountId: row.accountId, code: row.accountCode, nameAr: row.accountNameAr, nameFr: row.accountNameFr, nameEn: row.accountNameEn, accountType: row.accountType, debit: 0, credit: 0 };
    existing.debit += Number(row.debit); existing.credit += Number(row.credit); grouped.set(row.accountId, existing);
  });
  const lines = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code)).map(line => ({ ...line, closingDebit: Math.max(line.debit - line.credit, 0), closingCredit: Math.max(line.credit - line.debit, 0) }));
  return { lines, totals: lines.reduce((total, line) => ({ debit: total.debit + line.debit, credit: total.credit + line.credit, closingDebit: total.closingDebit + line.closingDebit, closingCredit: total.closingCredit + line.closingCredit }), { debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 }) };
}

export async function getProfitAndLossReport(organizationId: number, input: ReportRange = {}) {
  const trial = await getTrialBalanceReport(organizationId, input);
  const revenues = trial.lines.filter(line => line.accountType === "revenue").map(line => ({ ...line, amount: line.credit - line.debit }));
  const expenses = trial.lines.filter(line => line.accountType === "expense").map(line => ({ ...line, amount: line.debit - line.credit }));
  const cogs = expenses.filter(line => line.code === "5100").reduce((sum, line) => sum + line.amount, 0);
  const operatingExpenses = expenses.filter(line => line.code !== "5100").reduce((sum, line) => sum + line.amount, 0);
  const revenue = revenues.reduce((sum, line) => sum + line.amount, 0);
  return { revenues, expenses, revenue, cogs, grossProfit: revenue - cogs, operatingExpenses, operatingProfit: revenue - cogs - operatingExpenses, netProfit: revenue - cogs - operatingExpenses };
}

export async function getBalanceSheetReport(organizationId: number, input: ReportRange = {}) {
  const trial = await getTrialBalanceReport(organizationId, input);
  const assets = trial.lines.filter(line => line.accountType === "asset").map(line => ({ ...line, amount: line.debit - line.credit }));
  const liabilities = trial.lines.filter(line => line.accountType === "liability").map(line => ({ ...line, amount: line.credit - line.debit }));
  const equity = trial.lines.filter(line => line.accountType === "equity").map(line => ({ ...line, amount: line.credit - line.debit }));
  const profit = await getProfitAndLossReport(organizationId, input);
  const totals = { assets: assets.reduce((sum, line) => sum + line.amount, 0), liabilities: liabilities.reduce((sum, line) => sum + line.amount, 0), equity: equity.reduce((sum, line) => sum + line.amount, 0) + profit.netProfit };
  return { assets, liabilities, equity, currentPeriodProfit: profit.netProfit, totals: { ...totals, equationDifference: totals.assets - totals.liabilities - totals.equity } };
}

export async function getCashFlowReport(organizationId: number, input: ReportRange = {}) {
  const rows = await postedLineRows(organizationId, input);
  const movements = rows.filter(row => ["1001", "1002"].includes(row.accountCode)).map(row => ({ date: row.entryDate, journalNumber: row.journalNumber, reference: row.reference, accountCode: row.accountCode, accountNameAr: row.accountNameAr, inflow: Number(row.debit), outflow: Number(row.credit), net: Number(row.debit) - Number(row.credit) }));
  return { movements, inflow: movements.reduce((sum, row) => sum + row.inflow, 0), outflow: movements.reduce((sum, row) => sum + row.outflow, 0), netCashFlow: movements.reduce((sum, row) => sum + row.net, 0), method: "direct_ledger_cash_accounts" as const };
}
