import { and, eq, inArray, sql } from "drizzle-orm";
import { businessParties, purchaseOrders, salesInvoices } from "../drizzle/schema";
import { bankAccounts, bankMovements, cashboxMovements, cashboxes, cashTransfers, chartOfAccounts, payablePayments } from "../drizzle/financeSchema";
import { createJournalEntry, postJournalEntry, resolveAccountingMapping, resolvePostingContext } from "./finance";
import { getDb } from "./db";

type TreasuryKind = "cashbox" | "bank";
type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "90_plus";

async function assertAssetAccount(organizationId: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [account] = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(eq(chartOfAccounts.id, accountId), eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.accountType, "asset"), eq(chartOfAccounts.status, "active"))).limit(1);
  if (!account) throw new Error("حساب الخزينة يجب أن يكون أصلاً نشطاً ضمن المؤسسة الحالية.");
}

async function resolveTreasuryAccount(organizationId: number, kind: TreasuryKind, id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  if (kind === "cashbox") {
    const [cashbox] = await db.select().from(cashboxes).where(and(eq(cashboxes.id, id), eq(cashboxes.organizationId, organizationId), eq(cashboxes.status, "active"))).limit(1);
    if (!cashbox) throw new Error("الصندوق غير متاح ضمن المؤسسة الحالية.");
    return { accountId: cashbox.accountId, currencyCode: cashbox.currencyCode, journalCode: "CASH" as const };
  }
  const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.organizationId, organizationId), eq(bankAccounts.status, "active"))).limit(1);
  if (!bank) throw new Error("الحساب البنكي غير متاح ضمن المؤسسة الحالية.");
  return { accountId: bank.accountId, currencyCode: bank.currencyCode, journalCode: "BANK" as const };
}

function agingBucket(dueDate: Date | null, now: Date): AgingBucket {
  if (!dueDate || dueDate >= now) return "current";
  const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export async function createCashbox(organizationId: number, input: { code: string; name: string; currencyCode: string; accountId: number; branchId?: number }) {
  await assertAssetAccount(organizationId, input.accountId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(cashboxes).values({ organizationId, code: input.code.trim(), name: input.name.trim(), currencyCode: input.currencyCode.toUpperCase(), accountId: input.accountId, branchId: input.branchId, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function createBankAccount(organizationId: number, input: { code: string; name: string; bankName: string; accountNumberMasked?: string; currencyCode: string; accountId: number; branchId?: number }) {
  await assertAssetAccount(organizationId, input.accountId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(bankAccounts).values({ organizationId, code: input.code.trim(), name: input.name.trim(), bankName: input.bankName.trim(), accountNumberMasked: input.accountNumberMasked?.trim(), currencyCode: input.currencyCode.toUpperCase(), accountId: input.accountId, branchId: input.branchId, status: "active" });
  return { id: Number(result[0].insertId) };
}

export async function listTreasury(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [cashboxRows, bankRows, cashMovements, bankMovementRows] = await Promise.all([
    db.select().from(cashboxes).where(eq(cashboxes.organizationId, organizationId)),
    db.select().from(bankAccounts).where(eq(bankAccounts.organizationId, organizationId)),
    db.select().from(cashboxMovements).where(eq(cashboxMovements.organizationId, organizationId)),
    db.select().from(bankMovements).where(eq(bankMovements.organizationId, organizationId)),
  ]);
  const cashboxBalance = (cashboxId: number) => cashMovements.filter(row => row.cashboxId === cashboxId).reduce((sum, row) => sum + (row.direction === "in" || row.direction === "transfer_in" ? Number(row.amount) : -Number(row.amount)), 0);
  const bankBalance = (bankId: number) => bankMovementRows.filter(row => row.bankAccountId === bankId).reduce((sum, row) => sum + (row.direction === "in" || row.direction === "transfer_in" ? Number(row.amount) : -Number(row.amount)), 0);
  return { cashboxes: cashboxRows.map(row => ({ ...row, balance: cashboxBalance(row.id) })), banks: bankRows.map(row => ({ ...row, balance: bankBalance(row.id) })) };
}

export async function transferTreasuryFunds(organizationId: number, actorUserId: number, input: { fromType: TreasuryKind; fromId: number; toType: TreasuryKind; toId: number; amount: number; occurredAt: Date; notes?: string; idempotencyKey: string }) {
  if (input.amount <= 0 || (input.fromType === input.toType && input.fromId === input.toId)) throw new Error("بيانات التحويل بين حسابات الخزينة غير صالحة.");
  const [source, destination] = await Promise.all([resolveTreasuryAccount(organizationId, input.fromType, input.fromId), resolveTreasuryAccount(organizationId, input.toType, input.toId)]);
  if (source.currencyCode !== destination.currencyCode) throw new Error("يتطلب التحويل بين عملتين مختلفتين معالجة سعر صرف منفصلة.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [existing] = await db.select({ id: cashTransfers.id }).from(cashTransfers).where(and(eq(cashTransfers.organizationId, organizationId), eq(cashTransfers.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, replayed: true as const };
  return db.transaction(async tx => {
    const transfer = await tx.insert(cashTransfers).values({ organizationId, fromType: input.fromType, fromId: input.fromId, toType: input.toType, toId: input.toId, amount: String(input.amount), currencyCode: source.currencyCode, occurredAt: input.occurredAt, notes: input.notes?.trim(), idempotencyKey: input.idempotencyKey, createdByUserId: actorUserId });
    const transferId = Number(transfer[0].insertId);
    const sourceMovement = input.fromType === "cashbox"
      ? await tx.insert(cashboxMovements).values({ organizationId, cashboxId: input.fromId, direction: "transfer_out", amount: String(input.amount), currencyCode: source.currencyCode, occurredAt: input.occurredAt, referenceType: "cash_transfer", referenceId: transferId, notes: input.notes?.trim(), idempotencyKey: `${input.idempotencyKey}:out`, createdByUserId: actorUserId })
      : await tx.insert(bankMovements).values({ organizationId, bankAccountId: input.fromId, direction: "transfer_out", amount: String(input.amount), currencyCode: source.currencyCode, occurredAt: input.occurredAt, referenceType: "cash_transfer", referenceId: transferId, notes: input.notes?.trim(), idempotencyKey: `${input.idempotencyKey}:out`, createdByUserId: actorUserId });
    const destinationMovement = input.toType === "cashbox"
      ? await tx.insert(cashboxMovements).values({ organizationId, cashboxId: input.toId, direction: "transfer_in", amount: String(input.amount), currencyCode: source.currencyCode, occurredAt: input.occurredAt, referenceType: "cash_transfer", referenceId: transferId, notes: input.notes?.trim(), idempotencyKey: `${input.idempotencyKey}:in`, createdByUserId: actorUserId })
      : await tx.insert(bankMovements).values({ organizationId, bankAccountId: input.toId, direction: "transfer_in", amount: String(input.amount), currencyCode: source.currencyCode, occurredAt: input.occurredAt, referenceType: "cash_transfer", referenceId: transferId, notes: input.notes?.trim(), idempotencyKey: `${input.idempotencyKey}:in`, createdByUserId: actorUserId });
    const sourceMovementId = Number(sourceMovement[0].insertId);
    const destinationMovementId = Number(destinationMovement[0].insertId);
    const { journal, period } = await resolvePostingContext(organizationId, source.journalCode, input.occurredAt);
    const entry = await createJournalEntry(organizationId, actorUserId, { journalId: journal.id, fiscalPeriodId: period.id, entryDate: input.occurredAt, currencyCode: source.currencyCode, sourceModule: "treasury", sourceDocumentType: "cash_transfer", sourceDocumentId: transferId, reference: `TRF-${transferId}`, description: "تحويل بين حسابات الخزينة", lines: [{ accountId: destination.accountId, debit: input.amount, credit: 0 }, { accountId: source.accountId, debit: 0, credit: input.amount }] });
    await postJournalEntry(organizationId, actorUserId, entry.id);
    await tx.update(cashTransfers).set({ sourceMovementId, destinationMovementId, journalEntryId: entry.id }).where(and(eq(cashTransfers.id, transferId), eq(cashTransfers.organizationId, organizationId)));
    if (input.fromType === "cashbox") await tx.update(cashboxMovements).set({ journalEntryId: entry.id }).where(and(eq(cashboxMovements.id, sourceMovementId), eq(cashboxMovements.organizationId, organizationId))); else await tx.update(bankMovements).set({ journalEntryId: entry.id }).where(and(eq(bankMovements.id, sourceMovementId), eq(bankMovements.organizationId, organizationId)));
    if (input.toType === "cashbox") await tx.update(cashboxMovements).set({ journalEntryId: entry.id }).where(and(eq(cashboxMovements.id, destinationMovementId), eq(cashboxMovements.organizationId, organizationId))); else await tx.update(bankMovements).set({ journalEntryId: entry.id }).where(and(eq(bankMovements.id, destinationMovementId), eq(bankMovements.organizationId, organizationId)));
    return { id: transferId, journalEntryId: entry.id, replayed: false as const };
  });
}

export async function recordPayablePayment(organizationId: number, actorUserId: number, input: { supplierId: number; purchaseOrderId?: number; paymentAccountType: TreasuryKind; paymentAccountId: number; amount: number; occurredAt: Date; notes?: string; idempotencyKey: string }) {
  if (input.amount <= 0) throw new Error("يجب أن تكون قيمة دفعة المورد موجبة.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [supplier] = await db.select({ id: businessParties.id }).from(businessParties).where(and(eq(businessParties.id, input.supplierId), eq(businessParties.organizationId, organizationId))).limit(1);
  if (!supplier) throw new Error("المورد غير موجود ضمن المؤسسة الحالية.");
  const treasury = await resolveTreasuryAccount(organizationId, input.paymentAccountType, input.paymentAccountId);
  if (input.purchaseOrderId) {
    const [order] = await db.select({ supplierId: purchaseOrders.supplierId, status: purchaseOrders.status }).from(purchaseOrders).where(and(eq(purchaseOrders.id, input.purchaseOrderId), eq(purchaseOrders.organizationId, organizationId))).limit(1);
    if (!order || order.supplierId !== input.supplierId || order.status !== "received") throw new Error("أمر الشراء غير صالح لتسوية دفعة المورد.");
  }
  const [existing] = await db.select({ id: payablePayments.id }).from(payablePayments).where(and(eq(payablePayments.organizationId, organizationId), eq(payablePayments.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, replayed: true as const };
  const mapping = await resolveAccountingMapping(organizationId, "supplier_payment");
  return db.transaction(async tx => {
    const payment = await tx.insert(payablePayments).values({ organizationId, supplierId: input.supplierId, purchaseOrderId: input.purchaseOrderId, paymentAccountType: input.paymentAccountType, paymentAccountId: input.paymentAccountId, amount: String(input.amount), currencyCode: treasury.currencyCode, occurredAt: input.occurredAt, notes: input.notes?.trim(), idempotencyKey: input.idempotencyKey, createdByUserId: actorUserId });
    const paymentId = Number(payment[0].insertId);
    const movement = input.paymentAccountType === "cashbox"
      ? await tx.insert(cashboxMovements).values({ organizationId, cashboxId: input.paymentAccountId, direction: "out", amount: String(input.amount), currencyCode: treasury.currencyCode, occurredAt: input.occurredAt, referenceType: "payable_payment", referenceId: paymentId, counterpartyName: "مورد", notes: input.notes?.trim(), idempotencyKey: `${input.idempotencyKey}:out`, createdByUserId: actorUserId })
      : await tx.insert(bankMovements).values({ organizationId, bankAccountId: input.paymentAccountId, direction: "out", amount: String(input.amount), currencyCode: treasury.currencyCode, occurredAt: input.occurredAt, referenceType: "payable_payment", referenceId: paymentId, counterpartyName: "مورد", notes: input.notes?.trim(), idempotencyKey: `${input.idempotencyKey}:out`, createdByUserId: actorUserId });
    const movementId = Number(movement[0].insertId);
    const { journal, period } = await resolvePostingContext(organizationId, treasury.journalCode, input.occurredAt);
    const entry = await createJournalEntry(organizationId, actorUserId, { journalId: journal.id, fiscalPeriodId: period.id, entryDate: input.occurredAt, currencyCode: treasury.currencyCode, sourceModule: "treasury", sourceDocumentType: "payable_payment", sourceDocumentId: paymentId, reference: `PAY-${paymentId}`, description: "دفعة مورد", lines: [{ accountId: mapping.debitAccountId, debit: input.amount, credit: 0, partyId: input.supplierId }, { accountId: treasury.accountId, debit: 0, credit: input.amount, partyId: input.supplierId }] });
    await postJournalEntry(organizationId, actorUserId, entry.id);
    await tx.update(payablePayments).set({ journalEntryId: entry.id }).where(and(eq(payablePayments.id, paymentId), eq(payablePayments.organizationId, organizationId)));
    if (input.paymentAccountType === "cashbox") await tx.update(cashboxMovements).set({ journalEntryId: entry.id }).where(and(eq(cashboxMovements.id, movementId), eq(cashboxMovements.organizationId, organizationId))); else await tx.update(bankMovements).set({ journalEntryId: entry.id }).where(and(eq(bankMovements.id, movementId), eq(bankMovements.organizationId, organizationId)));
    return { id: paymentId, journalEntryId: entry.id, replayed: false as const };
  });
}

export async function getReceivableAging(organizationId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const invoices = await db.select({ id: salesInvoices.id, customerId: salesInvoices.customerId, invoiceNumber: salesInvoices.invoiceNumber, dueDate: salesInvoices.dueDate, total: salesInvoices.grandTotal, paid: salesInvoices.amountPaid, currencyCode: salesInvoices.currencyCode }).from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), inArray(salesInvoices.status, ["issued", "partial", "overdue"])));
  const items = invoices.map(row => ({ ...row, outstanding: Number(row.total) - Number(row.paid), bucket: agingBucket(row.dueDate, now) })).filter(row => row.outstanding > 0);
  return { items, totals: items.reduce((totals, item) => ({ ...totals, [item.bucket]: totals[item.bucket] + item.outstanding }), { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 } as Record<AgingBucket, number>) };
}

export async function getPayableAging(organizationId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [orders, payments] = await Promise.all([
    db.select({ id: purchaseOrders.id, supplierId: purchaseOrders.supplierId, orderNumber: purchaseOrders.orderNumber, dueDate: purchaseOrders.expectedAt, total: purchaseOrders.grandTotal, currencyCode: purchaseOrders.currencyCode }).from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, organizationId), inArray(purchaseOrders.status, ["partial", "received"]))),
    db.select({ purchaseOrderId: payablePayments.purchaseOrderId, amount: payablePayments.amount }).from(payablePayments).where(eq(payablePayments.organizationId, organizationId)),
  ]);
  const paidByOrder = new Map<number, number>();
  payments.forEach(payment => { if (payment.purchaseOrderId) paidByOrder.set(payment.purchaseOrderId, (paidByOrder.get(payment.purchaseOrderId) ?? 0) + Number(payment.amount)); });
  const items = orders.map(order => ({ ...order, outstanding: Number(order.total) - (paidByOrder.get(order.id) ?? 0), bucket: agingBucket(order.dueDate, now) })).filter(order => order.outstanding > 0);
  return { items, totals: items.reduce((totals, item) => ({ ...totals, [item.bucket]: totals[item.bucket] + item.outstanding }), { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 } as Record<AgingBucket, number>) };
}
