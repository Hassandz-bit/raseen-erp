import { and, eq } from "drizzle-orm";
import { auditLogs } from "../drizzle/schema";
import { employeeAdvances, payrollPeriods, payrollRunEmployees } from "../drizzle/hrPayrollSchema";
import { createJournalEntry, postJournalEntry, resolveAccountingMapping, resolvePostingContext } from "./finance";
import { getDb } from "./db";

const amount = (value: unknown) => Number(value ?? 0);

export async function postPayrollPeriod(organizationId: number, actorUserId: number, payrollPeriodId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [period] = await db.select().from(payrollPeriods).where(and(eq(payrollPeriods.id, payrollPeriodId), eq(payrollPeriods.organizationId, organizationId))).limit(1);
  if (!period || period.status !== "approved") throw new Error("لا يمكن ترحيل رواتب غير معتمدة ضمن المؤسسة.");
  const runs = await db.select().from(payrollRunEmployees).where(and(eq(payrollRunEmployees.organizationId, organizationId), eq(payrollRunEmployees.payrollPeriodId, payrollPeriodId)));
  if (!runs.length) throw new Error("لا توجد رواتب محسوبة قابلة للترحيل.");
  const gross = runs.reduce((sum, row) => sum + amount(row.grossPay), 0); const recovery = runs.reduce((sum, row) => sum + amount(row.advanceRecovery), 0);
  const [payrollMapping, recoveryMapping, context] = await Promise.all([resolveAccountingMapping(organizationId, "payroll_posting"), resolveAccountingMapping(organizationId, "employee_advance_recovery"), resolvePostingContext(organizationId, "GENERAL", period.paymentDate ?? period.endsAt)]);
  const entry = await createJournalEntry(organizationId, actorUserId, { journalId: context.journal.id, fiscalPeriodId: context.period.id, entryDate: period.paymentDate ?? period.endsAt, currencyCode: "BASE", reference: `PAYROLL-${payrollPeriodId}`, description: `ترحيل رواتب ${period.name}`, sourceModule: "hr", sourceDocumentType: "payroll_period", sourceDocumentId: payrollPeriodId, lines: [
    { accountId: payrollMapping.debitAccountId, debit: gross, credit: 0, description: "مصروف الرواتب" },
    { accountId: payrollMapping.creditAccountId, debit: 0, credit: gross, description: "رواتب مستحقة" },
    ...(recovery > 0 ? [{ accountId: recoveryMapping.debitAccountId, debit: recovery, credit: 0, description: "استرجاع سلف من الرواتب" }, { accountId: recoveryMapping.creditAccountId, debit: 0, credit: recovery, description: "تسوية سلف الموظفين" }] : []),
  ] });
  await postJournalEntry(organizationId, actorUserId, entry.id);
  await db.transaction(async tx => { await tx.update(payrollPeriods).set({ status: "posted" }).where(and(eq(payrollPeriods.id, payrollPeriodId), eq(payrollPeriods.organizationId, organizationId))); await tx.update(payrollRunEmployees).set({ status: "posted" }).where(and(eq(payrollRunEmployees.organizationId, organizationId), eq(payrollRunEmployees.payrollPeriodId, payrollPeriodId))); await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "hr.payroll_posted", entityType: "payroll_period", entityId: String(payrollPeriodId), metadata: { journalEntryId: entry.id, gross, recovery } }); });
  return { payrollPeriodId, journalEntryId: entry.id, gross, recovery, status: "posted" as const };
}

export async function payPayrollPeriod(organizationId: number, actorUserId: number, payrollPeriodId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [period] = await db.select().from(payrollPeriods).where(and(eq(payrollPeriods.id, payrollPeriodId), eq(payrollPeriods.organizationId, organizationId))).limit(1);
  if (!period || period.status !== "posted") throw new Error("لا يمكن دفع رواتب غير مرحّلة ضمن المؤسسة.");
  const runs = await db.select().from(payrollRunEmployees).where(and(eq(payrollRunEmployees.organizationId, organizationId), eq(payrollRunEmployees.payrollPeriodId, payrollPeriodId)));
  const net = runs.reduce((sum, row) => sum + amount(row.netPay), 0); if (net <= 0) throw new Error("لا يوجد صافي رواتب قابل للدفع.");
  const [mapping, context] = await Promise.all([resolveAccountingMapping(organizationId, "payroll_payment"), resolvePostingContext(organizationId, "GENERAL", period.paymentDate ?? new Date())]);
  const entry = await createJournalEntry(organizationId, actorUserId, { journalId: context.journal.id, fiscalPeriodId: context.period.id, entryDate: period.paymentDate ?? new Date(), currencyCode: "BASE", reference: `PAYROLL-PAY-${payrollPeriodId}`, description: `دفع رواتب ${period.name}`, sourceModule: "hr", sourceDocumentType: "payroll_payment", sourceDocumentId: payrollPeriodId, lines: [{ accountId: mapping.debitAccountId, debit: net, credit: 0, description: "تسوية رواتب مستحقة" }, { accountId: mapping.creditAccountId, debit: 0, credit: net, description: "دفع رواتب من خزينة أو بنك" }] });
  await postJournalEntry(organizationId, actorUserId, entry.id);
  await db.transaction(async tx => { for (const run of runs) { let remainingRecovery = amount(run.advanceRecovery); if (remainingRecovery <= 0) continue; const advances = await tx.select().from(employeeAdvances).where(and(eq(employeeAdvances.organizationId, organizationId), eq(employeeAdvances.employeeId, run.employeeId), eq(employeeAdvances.status, "paid"))); for (const advance of advances) { if (remainingRecovery <= 0) break; const outstanding = Math.max(amount(advance.amount) - amount(advance.recoveredAmount), 0); const recovered = Math.min(outstanding, remainingRecovery); if (recovered <= 0) continue; const recoveredAmount = amount(advance.recoveredAmount) + recovered; await tx.update(employeeAdvances).set({ recoveredAmount: String(recoveredAmount), status: recoveredAmount >= amount(advance.amount) ? "recovered" : "paid" }).where(and(eq(employeeAdvances.id, advance.id), eq(employeeAdvances.organizationId, organizationId))); remainingRecovery -= recovered; } if (remainingRecovery > 0) throw new Error("لا يمكن استرداد سلفة تتجاوز الرصيد المتبقي."); } await tx.update(payrollPeriods).set({ status: "paid" }).where(and(eq(payrollPeriods.id, payrollPeriodId), eq(payrollPeriods.organizationId, organizationId))); await tx.update(payrollRunEmployees).set({ status: "paid" }).where(and(eq(payrollRunEmployees.organizationId, organizationId), eq(payrollRunEmployees.payrollPeriodId, payrollPeriodId))); await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "hr.payroll_paid", entityType: "payroll_period", entityId: String(payrollPeriodId), metadata: { journalEntryId: entry.id, net } }); });
  return { payrollPeriodId, journalEntryId: entry.id, net, status: "paid" as const };
}

export async function postEmployeeAdvance(organizationId: number, actorUserId: number, advanceId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [advance] = await db.select().from(employeeAdvances).where(and(eq(employeeAdvances.id, advanceId), eq(employeeAdvances.organizationId, organizationId))).limit(1);
  if (!advance || advance.status !== "approved") throw new Error("لا يمكن ترحيل سلفة غير معتمدة ضمن المؤسسة.");
  const [mapping, context] = await Promise.all([resolveAccountingMapping(organizationId, "employee_advance_payment"), resolvePostingContext(organizationId, "GENERAL", advance.occurredAt)]);
  const entry = await createJournalEntry(organizationId, actorUserId, { journalId: context.journal.id, fiscalPeriodId: context.period.id, entryDate: advance.occurredAt, currencyCode: advance.currencyCode, reference: `ADV-${advance.id}`, description: `دفع سلفة موظف ${advance.employeeId}`, sourceModule: "hr", sourceDocumentType: "employee_advance", sourceDocumentId: advance.id, lines: [{ accountId: mapping.debitAccountId, debit: amount(advance.amount), credit: 0, description: "سلفة موظف" }, { accountId: mapping.creditAccountId, debit: 0, credit: amount(advance.amount), description: "دفع السلفة" }] });
  await postJournalEntry(organizationId, actorUserId, entry.id);
  await db.update(employeeAdvances).set({ status: "paid", journalEntryId: entry.id }).where(and(eq(employeeAdvances.id, advanceId), eq(employeeAdvances.organizationId, organizationId)));
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "hr.advance_posted", entityType: "employee_advance", entityId: String(advanceId), metadata: { journalEntryId: entry.id } });
  return { advanceId, journalEntryId: entry.id, status: "paid" as const };
}
