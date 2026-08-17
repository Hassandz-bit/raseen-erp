import { and, eq, inArray, sql } from "drizzle-orm";
import { distributionCollections, distributionRouteExpenses, financialTransactions, organizations, productBatches, purchaseOrders, salesInvoices, stockMovements } from "../drizzle/schema";
import { productionOutputs } from "../drizzle/manufacturingSchema";
import { createJournalEntry, postJournalEntry, resolveAccountingMapping, resolvePostingContext, type FinanceLineInput } from "./finance";
import { getDb } from "./db";

type PostingInput = { mappingKey: string; journalCode: string; entryDate: Date; currencyCode: string; exchangeRate: number; reference: string; description: string; sourceModule: string; sourceDocumentType: string; sourceDocumentId: number; lines: FinanceLineInput[] };

async function postAutomaticEntry(organizationId: number, actorUserId: number, input: PostingInput) {
  const { journal, period } = await resolvePostingContext(organizationId, input.journalCode, input.entryDate);
  const entry = await createJournalEntry(organizationId, actorUserId, {
    journalId: journal.id,
    fiscalPeriodId: period.id,
    entryDate: input.entryDate,
    currencyCode: input.currencyCode,
    exchangeRateSnapshot: input.exchangeRate,
    reference: input.reference,
    description: input.description,
    sourceModule: input.sourceModule,
    sourceDocumentType: input.sourceDocumentType,
    sourceDocumentId: input.sourceDocumentId,
    lines: input.lines,
  });
  return postJournalEntry(organizationId, actorUserId, entry.id);
}

async function organizationBaseCurrency(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [organization] = await db.select({ baseCurrency: organizations.baseCurrency }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization) throw new Error("المؤسسة غير موجودة.");
  return organization.baseCurrency;
}

async function issuedInventoryCost(organizationId: number, sourceDocumentType: string, sourceDocumentId: number, movementTypes: Array<typeof stockMovements.movementType.enumValues[number]>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ quantity: stockMovements.quantity, cost: productBatches.cost }).from(stockMovements).innerJoin(productBatches, and(eq(productBatches.id, stockMovements.batchId), eq(productBatches.organizationId, stockMovements.organizationId))).where(and(eq(stockMovements.organizationId, organizationId), eq(stockMovements.sourceDocumentType, sourceDocumentType), eq(stockMovements.sourceDocumentId, sourceDocumentId), inArray(stockMovements.movementType, movementTypes)));
  return rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.cost), 0);
}

export async function postSalesInvoice(organizationId: number, actorUserId: number, invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [invoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.organizationId, organizationId))).limit(1);
  if (!invoice || !["issued", "partial", "paid", "overdue"].includes(invoice.status)) throw new Error("لا يمكن ترحيل فاتورة مبيعات غير صادرة ضمن المؤسسة الحالية.");
  const salesMapping = await resolveAccountingMapping(organizationId, "sales_invoice");
  const total = Number(invoice.grandTotal);
  const tax = Number(invoice.taxAmount);
  const revenue = total - tax;
  if (tax > 0 && !salesMapping.taxAccountId) throw new Error("تتطلب الفاتورة الخاضعة للضريبة حساب ضريبة ضمن مطابقة المبيعات.");
  const cost = Math.max(0, -await issuedInventoryCost(organizationId, "sales_invoice", invoiceId, ["sales_issue"]));
  const costInInvoiceCurrency = Math.round((cost / Number(invoice.exchangeRateUsed)) * 100) / 100;
  const lines: FinanceLineInput[] = [
    { accountId: salesMapping.debitAccountId, debit: total, credit: 0, partyId: invoice.customerId ?? undefined, description: "ذمم فاتورة مبيعات" },
    { accountId: salesMapping.creditAccountId, debit: 0, credit: revenue, partyId: invoice.customerId ?? undefined, description: "إيراد فاتورة مبيعات" },
  ];
  if (tax > 0 && salesMapping.taxAccountId) lines.push({ accountId: salesMapping.taxAccountId, debit: 0, credit: tax, partyId: invoice.customerId ?? undefined, description: "ضريبة مبيعات" });
  if (costInInvoiceCurrency > 0) {
    const costMapping = await resolveAccountingMapping(organizationId, "sales_cost");
    lines.push({ accountId: costMapping.debitAccountId, debit: costInInvoiceCurrency, credit: 0, description: "تكلفة المبيعات" });
    lines.push({ accountId: costMapping.creditAccountId, debit: 0, credit: costInInvoiceCurrency, description: "إخراج تكلفة المخزون" });
  }
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey: "sales_invoice", journalCode: "SALES", entryDate: invoice.issuedAt ?? invoice.updatedAt, currencyCode: invoice.currencyCode, exchangeRate: Number(invoice.exchangeRateUsed), reference: invoice.invoiceNumber, description: `ترحيل تلقائي للفاتورة ${invoice.invoiceNumber}`, sourceModule: "sales", sourceDocumentType: "sales_invoice", sourceDocumentId: invoice.id, lines });
}

export async function postPurchaseOrder(organizationId: number, actorUserId: number, purchaseOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [order] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.organizationId, organizationId))).limit(1);
  if (!order || order.status !== "received") throw new Error("لا يمكن ترحيل أمر شراء قبل اكتمال استلامه ضمن المؤسسة الحالية.");
  const mapping = await resolveAccountingMapping(organizationId, "purchase_receipt");
  const total = await issuedInventoryCost(organizationId, "purchase_order", order.id, ["purchase_receipt"]);
  if (total <= 0) throw new Error("لا توجد قيمة استلام فعلية قابلة للترحيل لأمر الشراء.");
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey: "purchase_receipt", journalCode: "PURCHASE", entryDate: order.updatedAt, currencyCode: order.currencyCode, exchangeRate: Number(order.exchangeRateUsed), reference: order.orderNumber, description: `ترحيل تلقائي لاستلام أمر الشراء ${order.orderNumber}`, sourceModule: "purchases", sourceDocumentType: "purchase_order", sourceDocumentId: order.id, lines: [
    { accountId: mapping.debitAccountId, debit: total, credit: 0, partyId: order.supplierId ?? undefined, description: "زيادة المخزون من الاستلام" },
    { accountId: mapping.creditAccountId, debit: 0, credit: total, partyId: order.supplierId ?? undefined, description: "ذمم المورد" },
  ] });
}

export async function postCollection(organizationId: number, actorUserId: number, transactionId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [transaction] = await db.select().from(financialTransactions).where(and(eq(financialTransactions.id, transactionId), eq(financialTransactions.organizationId, organizationId))).limit(1);
  if (!transaction || transaction.type !== "income" || transaction.referenceType !== "sales_invoice" || !transaction.referenceId) throw new Error("لا تمثل الحركة تحصيلاً صالحاً لفاتورة مبيعات داخل المؤسسة.");
  const [invoice] = await db.select({ customerId: salesInvoices.customerId }).from(salesInvoices).where(and(eq(salesInvoices.id, transaction.referenceId), eq(salesInvoices.organizationId, organizationId))).limit(1);
  if (!invoice) throw new Error("الفاتورة المرجعية للتحصيل غير موجودة ضمن المؤسسة.");
  const mapping = await resolveAccountingMapping(organizationId, "sales_collection");
  const amount = Number(transaction.amount);
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey: "sales_collection", journalCode: "CASH", entryDate: transaction.occurredAt, currencyCode: await organizationBaseCurrency(organizationId), exchangeRate: 1, reference: `COL-${transaction.id}`, description: `ترحيل تلقائي لتحصيل الفاتورة ${transaction.referenceId}`, sourceModule: "finance", sourceDocumentType: "financial_transaction", sourceDocumentId: transaction.id, lines: [
    { accountId: mapping.debitAccountId, debit: amount, credit: 0, partyId: invoice.customerId ?? undefined, description: "تحصيل نقدي" },
    { accountId: mapping.creditAccountId, debit: 0, credit: amount, partyId: invoice.customerId ?? undefined, description: "تسوية ذمم عميل" },
  ] });
}

export async function postProductionMaterialIssue(organizationId: number, actorUserId: number, productionOrderId: number) {
  const amount = Math.max(0, -await issuedInventoryCost(organizationId, "production_order", productionOrderId, ["production_issue", "production_return"]));
  if (amount <= 0) throw new Error("لا توجد تكلفة مواد مصروفة قابلة للترحيل لأمر الإنتاج.");
  const mapping = await resolveAccountingMapping(organizationId, "production_material_issue");
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey: "production_material_issue", journalCode: "MANUFACTURING", entryDate: new Date(), currencyCode: await organizationBaseCurrency(organizationId), exchangeRate: 1, reference: `MO-${productionOrderId}`, description: `ترحيل مواد أمر الإنتاج ${productionOrderId}`, sourceModule: "manufacturing", sourceDocumentType: "production_material_issue", sourceDocumentId: productionOrderId, lines: [
    { accountId: mapping.debitAccountId, debit: amount, credit: 0, description: "إنتاج تحت التشغيل" },
    { accountId: mapping.creditAccountId, debit: 0, credit: amount, description: "صرف مواد خام" },
  ] });
}

export async function postDistributionCollection(organizationId: number, actorUserId: number, collectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [collection] = await db.select().from(distributionCollections).where(and(eq(distributionCollections.id, collectionId), eq(distributionCollections.organizationId, organizationId))).limit(1);
  if (!collection) throw new Error("إيصال تحصيل التوزيع غير موجود ضمن المؤسسة.");
  const mappingKey = collection.salesInvoiceId ? "sales_collection" : "distribution_cash_sale";
  const mapping = await resolveAccountingMapping(organizationId, mappingKey);
  const amount = Number(collection.amount);
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey, journalCode: "CASH", entryDate: collection.collectedAt, currencyCode: collection.currencyCode, exchangeRate: Number(collection.exchangeRateUsed), reference: collection.receiptNumber, description: `ترحيل تلقائي لتحصيل التوزيع ${collection.receiptNumber}`, sourceModule: "distribution", sourceDocumentType: "distribution_collection", sourceDocumentId: collection.id, lines: [
    { accountId: mapping.debitAccountId, debit: amount, credit: 0, partyId: collection.customerId, description: "نقدية محصلة من التوزيع" },
    { accountId: mapping.creditAccountId, debit: 0, credit: amount, partyId: collection.customerId, description: collection.salesInvoiceId ? "تسوية ذمم عميل" : "إيراد بيع نقدي" },
  ] });
}

export async function postDistributionRouteExpense(organizationId: number, actorUserId: number, expenseId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [expense] = await db.select().from(distributionRouteExpenses).where(and(eq(distributionRouteExpenses.id, expenseId), eq(distributionRouteExpenses.organizationId, organizationId))).limit(1);
  if (!expense) throw new Error("مصروف الجولة غير موجود ضمن المؤسسة.");
  const mapping = await resolveAccountingMapping(organizationId, "distribution_route_expense");
  const amount = Number(expense.amount);
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey: "distribution_route_expense", journalCode: "CASH", entryDate: expense.createdAt, currencyCode: expense.currencyCode, exchangeRate: 1, reference: `ROUTE-EXP-${expense.id}`, description: `ترحيل تلقائي لمصروف الجولة ${expense.routeId}`, sourceModule: "distribution", sourceDocumentType: "distribution_route_expense", sourceDocumentId: expense.id, lines: [
    { accountId: mapping.debitAccountId, debit: amount, credit: 0, description: `مصروف توزيع: ${expense.category}` },
    { accountId: mapping.creditAccountId, debit: 0, credit: amount, description: "نقدية مصروف الجولة" },
  ] });
}

export async function postProductionOutput(organizationId: number, actorUserId: number, productionOutputId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [output] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.id, productionOutputId), eq(productionOutputs.organizationId, organizationId))).limit(1);
  if (!output || !output.unitCost || Number(output.goodQuantity) <= 0) throw new Error("مخرج الإنتاج غير صالح للترحيل المحاسبي.");
  const amount = Number(output.goodQuantity) * Number(output.unitCost);
  const mapping = await resolveAccountingMapping(organizationId, "production_output");
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey: "production_output", journalCode: "MANUFACTURING", entryDate: output.createdAt, currencyCode: await organizationBaseCurrency(organizationId), exchangeRate: 1, reference: `PO-${output.id}`, description: `ترحيل مخرج الإنتاج ${output.id}`, sourceModule: "manufacturing", sourceDocumentType: "production_output", sourceDocumentId: output.id, lines: [
    { accountId: mapping.debitAccountId, debit: amount, credit: 0, description: "زيادة مخزون تام" },
    { accountId: mapping.creditAccountId, debit: 0, credit: amount, description: "تسوية إنتاج تحت التشغيل" },
  ] });
}

export async function postInventoryAdjustment(organizationId: number, actorUserId: number, stockMovementId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [row] = await db.select({ movement: stockMovements, cost: productBatches.cost }).from(stockMovements).leftJoin(productBatches, and(eq(productBatches.id, stockMovements.batchId), eq(productBatches.organizationId, stockMovements.organizationId))).where(and(eq(stockMovements.id, stockMovementId), eq(stockMovements.organizationId, organizationId), inArray(stockMovements.movementType, ["adjustment", "count_adjustment"]))).limit(1);
  if (!row) throw new Error("حركة تسوية المخزون غير موجودة ضمن المؤسسة.");
  const quantity = Number(row.movement.quantity);
  const amount = Math.abs(quantity * Number(row.cost ?? 0));
  if (amount <= 0) throw new Error("لا يمكن ترحيل تسوية مخزون بلا تكلفة دفعة مثبتة.");
  const mappingKey = quantity < 0 ? "inventory_adjustment_loss" : "inventory_adjustment_gain";
  const mapping = await resolveAccountingMapping(organizationId, mappingKey);
  return postAutomaticEntry(organizationId, actorUserId, { mappingKey, journalCode: "INVENTORY", entryDate: row.movement.occurredAt, currencyCode: await organizationBaseCurrency(organizationId), exchangeRate: 1, reference: `ADJ-${row.movement.id}`, description: `ترحيل تسوية مخزون ${row.movement.id}`, sourceModule: "inventory", sourceDocumentType: "stock_movement", sourceDocumentId: row.movement.id, lines: [
    { accountId: mapping.debitAccountId, debit: amount, credit: 0, description: "الطرف المدين لتسوية المخزون" },
    { accountId: mapping.creditAccountId, debit: 0, credit: amount, description: "الطرف الدائن لتسوية المخزون" },
  ] });
}
