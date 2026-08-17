import { and, eq, lte } from "drizzle-orm";
import { auditLogs } from "../drizzle/schema";
import { bankAccounts, bankMovements, bankReconciliationLines, bankReconciliations, cashboxMovements, cashboxes, cashReconciliations } from "../drizzle/financeSchema";
import { getDb } from "./db";

const signed = (direction: "in" | "out" | "transfer_in" | "transfer_out", amount: unknown) => (direction === "in" || direction === "transfer_in" ? Number(amount) : -Number(amount));

export async function createBankReconciliation(organizationId: number, actorUserId: number, input: { bankAccountId: number; statementDate: Date; statementEndingBalance: number; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [account] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.organizationId, organizationId), eq(bankAccounts.status, "active"))).limit(1);
  if (!account) throw new Error("الحساب البنكي غير متاح ضمن المؤسسة الحالية.");
  const movements = await db.select({ direction: bankMovements.direction, amount: bankMovements.amount }).from(bankMovements).where(and(eq(bankMovements.organizationId, organizationId), eq(bankMovements.bankAccountId, input.bankAccountId), lte(bankMovements.occurredAt, input.statementDate)));
  const systemBalance = movements.reduce((total, movement) => total + signed(movement.direction, movement.amount), 0);
  const difference = input.statementEndingBalance - systemBalance;
  const result = await db.insert(bankReconciliations).values({ organizationId, bankAccountId: input.bankAccountId, statementDate: input.statementDate, statementEndingBalance: String(input.statementEndingBalance), systemBalance: String(systemBalance), difference: String(difference), notes: input.notes?.trim(), createdByUserId: actorUserId, status: "draft" });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.bank_reconciliation_created", entityType: "bank_reconciliation", entityId: String(id), metadata: { bankAccountId: input.bankAccountId, statementDate: input.statementDate, difference } });
  return { id, systemBalance, difference, status: "draft" as const };
}

export async function addBankReconciliationLine(organizationId: number, actorUserId: number, input: { reconciliationId: number; bankMovementId?: number; statementReference?: string; statementDate?: Date; amount: number; direction: "in" | "out"; matchStatus: "matched" | "unmatched" | "excluded"; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [reconciliation] = await db.select().from(bankReconciliations).where(and(eq(bankReconciliations.id, input.reconciliationId), eq(bankReconciliations.organizationId, organizationId))).limit(1);
  if (!reconciliation || reconciliation.status !== "draft") throw new Error("لا يمكن إضافة سطر إلى مصالحة غير مسودة ضمن المؤسسة.");
  if (input.bankMovementId) {
    const [movement] = await db.select().from(bankMovements).where(and(eq(bankMovements.id, input.bankMovementId), eq(bankMovements.organizationId, organizationId), eq(bankMovements.bankAccountId, reconciliation.bankAccountId))).limit(1);
    if (!movement) throw new Error("حركة البنك غير متاحة للحساب البنكي المطلوب.");
  }
  const result = await db.insert(bankReconciliationLines).values({ organizationId, reconciliationId: input.reconciliationId, bankMovementId: input.bankMovementId, statementReference: input.statementReference?.trim(), statementDate: input.statementDate, amount: String(input.amount), direction: input.direction, matchStatus: input.matchStatus, notes: input.notes?.trim() });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.bank_reconciliation_line_added", entityType: "bank_reconciliation_line", entityId: String(id), metadata: { reconciliationId: input.reconciliationId, bankMovementId: input.bankMovementId ?? null, matchStatus: input.matchStatus } });
  return { id };
}

export async function changeBankReconciliationStatus(organizationId: number, actorUserId: number, reconciliationId: number, status: "reviewed" | "approved" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [reconciliation] = await db.select().from(bankReconciliations).where(and(eq(bankReconciliations.id, reconciliationId), eq(bankReconciliations.organizationId, organizationId))).limit(1);
  if (!reconciliation || reconciliation.status !== "draft") throw new Error("المصالحة غير متاحة للتغيير ضمن المؤسسة.");
  if (status === "approved" && Number(reconciliation.difference) !== 0) throw new Error("لا يمكن اعتماد مصالحة بنكية تحتوي فرقاً غير معالج.");
  await db.transaction(async tx => {
    await tx.update(bankReconciliations).set({ status, reviewedByUserId: actorUserId, reviewedAt: new Date() }).where(and(eq(bankReconciliations.id, reconciliationId), eq(bankReconciliations.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.bank_reconciliation_status_changed", entityType: "bank_reconciliation", entityId: String(reconciliationId), metadata: { status } });
  });
  return { id: reconciliationId, status };
}

export async function createCashReconciliation(organizationId: number, actorUserId: number, input: { cashboxId: number; reconciledAt: Date; actualBalance: number; reason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [cashbox] = await db.select().from(cashboxes).where(and(eq(cashboxes.id, input.cashboxId), eq(cashboxes.organizationId, organizationId), eq(cashboxes.status, "active"))).limit(1);
  if (!cashbox) throw new Error("الصندوق غير متاح ضمن المؤسسة الحالية.");
  const movements = await db.select({ direction: cashboxMovements.direction, amount: cashboxMovements.amount }).from(cashboxMovements).where(and(eq(cashboxMovements.organizationId, organizationId), eq(cashboxMovements.cashboxId, input.cashboxId), lte(cashboxMovements.occurredAt, input.reconciledAt)));
  const expectedBalance = movements.reduce((total, movement) => total + signed(movement.direction, movement.amount), 0);
  const difference = input.actualBalance - expectedBalance;
  if (difference !== 0 && !input.reason?.trim()) throw new Error("يلزم توثيق سبب فرق الصندوق قبل حفظ المصالحة.");
  const result = await db.insert(cashReconciliations).values({ organizationId, cashboxId: input.cashboxId, reconciledAt: input.reconciledAt, expectedBalance: String(expectedBalance), actualBalance: String(input.actualBalance), difference: String(difference), reason: input.reason?.trim(), createdByUserId: actorUserId, status: "draft" });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "finance.cash_reconciliation_created", entityType: "cash_reconciliation", entityId: String(id), metadata: { cashboxId: input.cashboxId, difference } });
  return { id, expectedBalance, difference, status: "draft" as const };
}

export async function listReconciliations(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [banks, cash] = await Promise.all([db.select().from(bankReconciliations).where(eq(bankReconciliations.organizationId, organizationId)), db.select().from(cashReconciliations).where(eq(cashReconciliations.organizationId, organizationId))]);
  return { banks, cash };
}
