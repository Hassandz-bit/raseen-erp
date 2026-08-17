import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLogs, organizations, salesInvoices } from "../drizzle/schema";
import { accountingJournals, accountingMappings, bankAccounts, bankMovements, cashboxMovements, cashboxes, cashTransfers, chartOfAccounts, fiscalPeriods, fiscalYears, journalEntries, journalLines, payablePayments } from "../drizzle/financeSchema";
import { createFiscalPeriod, createFiscalYear, listChartOfAccounts, seedDefaultChartOfAccounts } from "./finance";
import { createBankAccount, createCashbox, getReceivableAging, listTreasury, transferTreasuryFunds } from "./treasury";
import { getDb } from "./db";

let organizationId: number | null = null;

afterEach(async () => {
  if (!organizationId) return;
  const db = await getDb();
  if (!db) return;
  const id = organizationId;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, id));
  await db.delete(salesInvoices).where(eq(salesInvoices.organizationId, id));
  await db.delete(cashboxMovements).where(eq(cashboxMovements.organizationId, id));
  await db.delete(bankMovements).where(eq(bankMovements.organizationId, id));
  await db.delete(cashTransfers).where(eq(cashTransfers.organizationId, id));
  await db.delete(payablePayments).where(eq(payablePayments.organizationId, id));
  await db.delete(journalLines).where(eq(journalLines.organizationId, id));
  await db.delete(journalEntries).where(eq(journalEntries.organizationId, id));
  await db.delete(cashboxes).where(eq(cashboxes.organizationId, id));
  await db.delete(bankAccounts).where(eq(bankAccounts.organizationId, id));
  await db.delete(accountingMappings).where(eq(accountingMappings.organizationId, id));
  await db.delete(fiscalPeriods).where(eq(fiscalPeriods.organizationId, id));
  await db.delete(fiscalYears).where(eq(fiscalYears.organizationId, id));
  await db.delete(accountingJournals).where(eq(accountingJournals.organizationId, id));
  await db.delete(chartOfAccounts).where(eq(chartOfAccounts.organizationId, id));
  await db.delete(organizations).where(eq(organizations.id, id));
  organizationId = null;
});

describe("تكامل الخزينة والذمم", () => {
  it("ينشئ حسابات خزينة ويمنع تكرار التحويل ويحسب أرصدة وحالة أعمار الذمم بعزل المؤسسة", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const organization = await db.insert(organizations).values({ name: `اختبار خزينة ${suffix}`, slug: `treasury-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(organization[0].insertId);
    await seedDefaultChartOfAccounts(organizationId);
    const year = await createFiscalYear(organizationId, { name: `FY-${suffix}`, startsAt: new Date("2026-01-01T00:00:00.000Z"), endsAt: new Date("2026-12-31T23:59:59.999Z") });
    await createFiscalPeriod(organizationId, { fiscalYearId: year.id, name: `AUG-${suffix}`, startsAt: new Date("2026-08-01T00:00:00.000Z"), endsAt: new Date("2026-08-31T23:59:59.999Z") });
    const accounts = await listChartOfAccounts(organizationId);
    const cashAccount = accounts.find(account => account.code === "1001");
    const bankAccount = accounts.find(account => account.code === "1002");
    if (!cashAccount || !bankAccount) throw new Error("لم تنشأ حسابات الخزينة الافتراضية.");
    const cashbox = await createCashbox(organizationId, { code: "MAIN", name: "الصندوق الرئيسي", currencyCode: "SAR", accountId: cashAccount.id });
    const bank = await createBankAccount(organizationId, { code: "BANK1", name: "الحساب التشغيلي", bankName: "بنك الاختبار", currencyCode: "SAR", accountId: bankAccount.id });
    const transfer = await transferTreasuryFunds(organizationId, 1, { fromType: "cashbox", fromId: cashbox.id, toType: "bank", toId: bank.id, amount: 250, occurredAt: new Date("2026-08-17T12:00:00.000Z"), idempotencyKey: `transfer-${suffix}` });
    expect(transfer.replayed).toBe(false);
    await expect(transferTreasuryFunds(organizationId, 1, { fromType: "cashbox", fromId: cashbox.id, toType: "bank", toId: bank.id, amount: 250, occurredAt: new Date("2026-08-17T12:00:00.000Z"), idempotencyKey: `transfer-${suffix}` })).resolves.toMatchObject({ id: transfer.id, replayed: true });
    const treasury = await listTreasury(organizationId);
    expect(treasury.cashboxes.find(row => row.id === cashbox.id)?.balance).toBe(-250);
    expect(treasury.banks.find(row => row.id === bank.id)?.balance).toBe(250);
    await db.insert(salesInvoices).values({ organizationId, invoiceNumber: `INV-${suffix}`, status: "issued", currencyCode: "SAR", baseCurrencyCode: "SAR", exchangeRateUsed: "1", grandTotal: "100", amountPaid: "20", dueDate: new Date("2026-06-01T00:00:00.000Z") });
    const aging = await getReceivableAging(organizationId, new Date("2026-08-17T12:00:00.000Z"));
    expect(aging.totals["61_90"]).toBe(80);
  });
});
