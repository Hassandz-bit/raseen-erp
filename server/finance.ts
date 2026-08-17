import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { accountingJournals, accountingMappings, chartOfAccounts, fiscalPeriods, fiscalYears, journalEntries, journalLines } from "../drizzle/financeSchema";
import { auditLogs } from "../drizzle/schema";
import { assertBalancedJournal, assertPostableJournal, assertReversibleJournal, type AccountingLineInput } from "./accountingPolicy";
import { getDb } from "./db";

type AccountSeed = { code: string; parentCode?: string; nameAr: string; nameFr: string; nameEn: string; accountType: "asset" | "liability" | "equity" | "revenue" | "expense"; allowManualPosting?: "yes" | "no" };
export type FinanceLineInput = AccountingLineInput & { accountId: number; branchId?: number; costCenterId?: number; partyId?: number; description?: string };

const defaultAccounts: AccountSeed[] = [
  { code: "1000", nameAr: "الأصول", nameFr: "Actifs", nameEn: "Assets", accountType: "asset", allowManualPosting: "no" },
  { code: "1001", parentCode: "1000", nameAr: "الصندوق", nameFr: "Caisse", nameEn: "Cash on hand", accountType: "asset" },
  { code: "1002", parentCode: "1000", nameAr: "البنوك", nameFr: "Banques", nameEn: "Bank accounts", accountType: "asset" },
  { code: "1100", parentCode: "1000", nameAr: "الذمم المدينة", nameFr: "Créances clients", nameEn: "Accounts receivable", accountType: "asset" },
  { code: "1200", parentCode: "1000", nameAr: "المخزون", nameFr: "Stocks", nameEn: "Inventory", accountType: "asset" },
  { code: "1300", parentCode: "1000", nameAr: "إنتاج تحت التشغيل", nameFr: "Production en cours", nameEn: "Work in progress", accountType: "asset" },
  { code: "2000", nameAr: "الالتزامات", nameFr: "Passifs", nameEn: "Liabilities", accountType: "liability", allowManualPosting: "no" },
  { code: "2100", parentCode: "2000", nameAr: "الذمم الدائنة", nameFr: "Dettes fournisseurs", nameEn: "Accounts payable", accountType: "liability" },
  { code: "2200", parentCode: "2000", nameAr: "الضرائب المستحقة", nameFr: "Taxes à payer", nameEn: "Taxes payable", accountType: "liability" },
  { code: "3000", nameAr: "حقوق الملكية", nameFr: "Capitaux propres", nameEn: "Equity", accountType: "equity", allowManualPosting: "no" },
  { code: "3100", parentCode: "3000", nameAr: "رأس المال", nameFr: "Capital", nameEn: "Capital", accountType: "equity" },
  { code: "4000", nameAr: "الإيرادات", nameFr: "Produits", nameEn: "Revenue", accountType: "revenue", allowManualPosting: "no" },
  { code: "4100", parentCode: "4000", nameAr: "إيرادات المبيعات", nameFr: "Ventes", nameEn: "Sales revenue", accountType: "revenue" },
  { code: "5000", nameAr: "المصروفات", nameFr: "Charges", nameEn: "Expenses", accountType: "expense", allowManualPosting: "no" },
  { code: "5100", parentCode: "5000", nameAr: "تكلفة المبيعات", nameFr: "Coût des ventes", nameEn: "Cost of sales", accountType: "expense" },
  { code: "5200", parentCode: "5000", nameAr: "مصروفات تشغيلية", nameFr: "Charges d'exploitation", nameEn: "Operating expenses", accountType: "expense" },
];

const defaultJournals = [
  { code: "SALES", name: "يومية المبيعات", journalType: "sales" as const },
  { code: "PURCHASE", name: "يومية المشتريات", journalType: "purchase" as const },
  { code: "CASH", name: "يومية الصندوق", journalType: "cash" as const },
  { code: "BANK", name: "يومية البنك", journalType: "bank" as const },
  { code: "INVENTORY", name: "يومية المخزون", journalType: "inventory" as const },
  { code: "MANUFACTURING", name: "يومية التصنيع", journalType: "manufacturing" as const },
  { code: "GENERAL", name: "اليومية العامة", journalType: "general" as const },
];

const defaultMappings = [
  { mappingKey: "sales_invoice", debitCode: "1100", creditCode: "4100", taxCode: "2200" },
  { mappingKey: "sales_cost", debitCode: "5100", creditCode: "1200" },
  { mappingKey: "sales_collection", debitCode: "1001", creditCode: "1100" },
  { mappingKey: "distribution_cash_sale", debitCode: "1001", creditCode: "4100" },
  { mappingKey: "distribution_route_expense", debitCode: "5200", creditCode: "1001" },
  { mappingKey: "purchase_receipt", debitCode: "1200", creditCode: "2100" },
  { mappingKey: "supplier_payment", debitCode: "2100", creditCode: "1001" },
  { mappingKey: "production_material_issue", debitCode: "1300", creditCode: "1200" },
  { mappingKey: "production_output", debitCode: "1200", creditCode: "1300" },
  { mappingKey: "inventory_adjustment_loss", debitCode: "5100", creditCode: "1200" },
  { mappingKey: "inventory_adjustment_gain", debitCode: "1200", creditCode: "5100" },
];

const entryNumber = () => `JE-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export async function seedDefaultChartOfAccounts(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    for (const account of defaultAccounts) {
      const parent = account.parentCode
        ? (await tx.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(and(eq(chartOfAccounts.organizationId, organizationId), eq(chartOfAccounts.code, account.parentCode))).limit(1))[0]
        : undefined;
      await tx.insert(chartOfAccounts).values({ organizationId, code: account.code, nameAr: account.nameAr, nameFr: account.nameFr, nameEn: account.nameEn, accountType: account.accountType, parentAccountId: parent?.id, level: account.parentCode ? 2 : 1, allowManualPosting: account.allowManualPosting ?? "yes", status: "active" }).onDuplicateKeyUpdate({ set: { nameAr: account.nameAr, nameFr: account.nameFr, nameEn: account.nameEn, status: "active" } });
    }
    for (const journal of defaultJournals) await tx.insert(accountingJournals).values({ organizationId, ...journal, status: "active" }).onDuplicateKeyUpdate({ set: { name: journal.name, status: "active" } });
    const accounts = await tx.select({ id: chartOfAccounts.id, code: chartOfAccounts.code }).from(chartOfAccounts).where(eq(chartOfAccounts.organizationId, organizationId));
    const accountByCode = new Map(accounts.map(account => [account.code, account.id]));
    for (const mapping of defaultMappings) {
      const debitAccountId = accountByCode.get(mapping.debitCode);
      const creditAccountId = accountByCode.get(mapping.creditCode);
      if (!debitAccountId || !creditAccountId) throw new Error("تعذر إنشاء مطابقة حسابية من دليل الحسابات الافتراضي.");
      const taxAccountId = mapping.taxCode ? accountByCode.get(mapping.taxCode) : undefined;
      await tx.insert(accountingMappings).values({ organizationId, mappingKey: mapping.mappingKey, debitAccountId, creditAccountId, taxAccountId, status: "active" }).onDuplicateKeyUpdate({ set: { debitAccountId, creditAccountId, taxAccountId, status: "active" } });
    }
    return { accounts: accounts.length, journals: defaultJournals.length, mappings: defaultMappings.length };
  });
}

export async function createFiscalYear(organizationId: number, input: { name: string; startsAt: Date; endsAt: Date }) {
  if (input.endsAt <= input.startsAt) throw new Error("يجب أن تنتهي السنة المالية بعد تاريخ بدايتها.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.insert(fiscalYears).values({ organizationId, name: input.name.trim(), startsAt: input.startsAt, endsAt: input.endsAt, status: "open" });
  return { id: Number(result[0].insertId), status: "open" as const };
}

export async function createFiscalPeriod(organizationId: number, input: { fiscalYearId: number; name: string; startsAt: Date; endsAt: Date }) {
  if (input.endsAt <= input.startsAt) throw new Error("يجب أن تنتهي الفترة المالية بعد تاريخ بدايتها.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [year] = await db.select().from(fiscalYears).where(and(eq(fiscalYears.id, input.fiscalYearId), eq(fiscalYears.organizationId, organizationId))).limit(1);
  if (!year) throw new Error("السنة المالية غير موجودة ضمن المؤسسة الحالية.");
  if (input.startsAt < year.startsAt || input.endsAt > year.endsAt) throw new Error("يجب أن تقع الفترة داخل حدود السنة المالية المحددة.");
  const result = await db.insert(fiscalPeriods).values({ organizationId, fiscalYearId: input.fiscalYearId, name: input.name.trim(), startsAt: input.startsAt, endsAt: input.endsAt, status: "open" });
  return { id: Number(result[0].insertId), status: "open" as const };
}

export async function changeFiscalPeriodStatus(organizationId: number, actorUserId: number, fiscalPeriodId: number, status: "open" | "closed" | "locked", reason: string) {
  if (reason.trim().length < 3) throw new Error("يلزم إدخال سبب واضح لتغيير حالة الفترة المالية.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [period] = await db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.id, fiscalPeriodId), eq(fiscalPeriods.organizationId, organizationId))).limit(1);
  if (!period) throw new Error("الفترة المالية غير موجودة ضمن المؤسسة الحالية.");
  if (period.status === status) return { id: period.id, status, unchanged: true as const };
  await db.transaction(async tx => {
    await tx.update(fiscalPeriods).set({ status }).where(and(eq(fiscalPeriods.id, fiscalPeriodId), eq(fiscalPeriods.organizationId, organizationId)));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: status === "open" ? "accounting.period_reopened" : "accounting.period_closed", entityType: "fiscal_period", entityId: String(fiscalPeriodId), metadata: { previousStatus: period.status, nextStatus: status, reason: reason.trim() } });
  });
  return { id: fiscalPeriodId, status, unchanged: false as const };
}

export async function createJournalEntry(organizationId: number, actorUserId: number, input: { journalId: number; fiscalPeriodId: number; entryDate: Date; currencyCode: string; exchangeRateSnapshot?: number; reference?: string; description?: string; sourceModule?: string; sourceDocumentType?: string; sourceDocumentId?: number; lines: FinanceLineInput[] }) {
  assertBalancedJournal(input.lines);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const [journalRows, periodRows] = await Promise.all([
      tx.select({ id: accountingJournals.id, status: accountingJournals.status }).from(accountingJournals).where(and(eq(accountingJournals.id, input.journalId), eq(accountingJournals.organizationId, organizationId))).limit(1),
      tx.select({ id: fiscalPeriods.id, status: fiscalPeriods.status, startsAt: fiscalPeriods.startsAt, endsAt: fiscalPeriods.endsAt }).from(fiscalPeriods).where(and(eq(fiscalPeriods.id, input.fiscalPeriodId), eq(fiscalPeriods.organizationId, organizationId))).limit(1),
    ]);
    const [journal] = journalRows;
    const [period] = periodRows;
    if (!journal || journal.status !== "active") throw new Error("الدفتر المحاسبي غير متاح ضمن المؤسسة الحالية.");
    if (!period || input.entryDate < period.startsAt || input.entryDate > period.endsAt) throw new Error("تاريخ القيد لا يقع داخل الفترة المالية المحددة.");
    const accountRows = await tx.select({ id: chartOfAccounts.id, status: chartOfAccounts.status, allowManualPosting: chartOfAccounts.allowManualPosting }).from(chartOfAccounts).where(and(eq(chartOfAccounts.organizationId, organizationId), inArray(chartOfAccounts.id, input.lines.map(line => line.accountId))));
    if (accountRows.length !== new Set(input.lines.map(line => line.accountId)).size || accountRows.some(account => account.status !== "active")) throw new Error("يحتوي القيد على حساب غير نشط أو خارج المؤسسة الحالية.");
    if (!input.sourceModule && accountRows.some(account => account.allowManualPosting !== "yes")) throw new Error("لا يسمح بالقيود اليدوية على الحسابات التجميعية.");
    if (input.sourceModule && input.sourceDocumentType && input.sourceDocumentId) {
      const [existing] = await tx.select({ id: journalEntries.id }).from(journalEntries).where(and(eq(journalEntries.organizationId, organizationId), eq(journalEntries.sourceModule, input.sourceModule), eq(journalEntries.sourceDocumentType, input.sourceDocumentType), eq(journalEntries.sourceDocumentId, input.sourceDocumentId))).limit(1);
      if (existing) throw new Error("يوجد قيد محاسبي سابق لهذا المستند التشغيلي.");
    }
    const inserted = await tx.insert(journalEntries).values({ organizationId, journalId: input.journalId, fiscalPeriodId: input.fiscalPeriodId, journalNumber: entryNumber(), entryDate: input.entryDate, currencyCode: input.currencyCode, exchangeRateSnapshot: String(input.exchangeRateSnapshot ?? 1), reference: input.reference?.trim(), description: input.description?.trim(), sourceModule: input.sourceModule, sourceDocumentType: input.sourceDocumentType, sourceDocumentId: input.sourceDocumentId, status: "draft" });
    const journalEntryId = Number(inserted[0].insertId);
    await tx.insert(journalLines).values(input.lines.map(line => ({ organizationId, journalEntryId, accountId: line.accountId, debit: String(line.debit), credit: String(line.credit), currencyCode: input.currencyCode, baseCurrencyAmount: String((line.debit || line.credit) * (input.exchangeRateSnapshot ?? 1)), branchId: line.branchId, costCenterId: line.costCenterId, partyId: line.partyId, description: line.description?.trim() })));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "accounting.journal_entry_created", entityType: "journal_entry", entityId: String(journalEntryId), metadata: { fiscalPeriodId: input.fiscalPeriodId, sourceModule: input.sourceModule ?? null, sourceDocumentId: input.sourceDocumentId ?? null } });
    return { id: journalEntryId, status: "draft" as const };
  });
}

export async function postJournalEntry(organizationId: number, actorUserId: number, journalEntryId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const [entry] = await tx.select({ id: journalEntries.id, status: journalEntries.status, fiscalPeriodId: journalEntries.fiscalPeriodId }).from(journalEntries).where(and(eq(journalEntries.id, journalEntryId), eq(journalEntries.organizationId, organizationId))).limit(1);
    if (!entry) throw new Error("القيد غير موجود ضمن المؤسسة الحالية.");
    const [period] = await tx.select({ status: fiscalPeriods.status }).from(fiscalPeriods).where(and(eq(fiscalPeriods.id, entry.fiscalPeriodId), eq(fiscalPeriods.organizationId, organizationId))).limit(1);
    if (!period) throw new Error("الفترة المالية المرتبطة بالقيد غير موجودة ضمن المؤسسة.");
    assertPostableJournal(entry.status, period.status);
    const lines = await tx.select({ debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).where(and(eq(journalLines.journalEntryId, journalEntryId), eq(journalLines.organizationId, organizationId)));
    assertBalancedJournal(lines.map(line => ({ debit: Number(line.debit), credit: Number(line.credit) })));
    await tx.update(journalEntries).set({ status: "posted", postedByUserId: actorUserId, postedAt: new Date() }).where(and(eq(journalEntries.id, journalEntryId), eq(journalEntries.organizationId, organizationId), eq(journalEntries.status, "draft")));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "accounting.journal_entry_posted", entityType: "journal_entry", entityId: String(journalEntryId), metadata: { fiscalPeriodId: entry.fiscalPeriodId } });
    return { id: journalEntryId, status: "posted" as const };
  });
}

export async function reverseJournalEntry(organizationId: number, actorUserId: number, journalEntryId: number, reversalPeriodId: number, note?: string, reversalDate = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.transaction(async tx => {
    const [source] = await tx.select().from(journalEntries).where(and(eq(journalEntries.id, journalEntryId), eq(journalEntries.organizationId, organizationId))).limit(1);
    if (!source) throw new Error("القيد غير موجود ضمن المؤسسة الحالية.");
    assertReversibleJournal(source.status);
    const [period] = await tx.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.id, reversalPeriodId), eq(fiscalPeriods.organizationId, organizationId))).limit(1);
    if (!period || period.status !== "open") throw new Error("يجب اختيار فترة مالية مفتوحة لعكس القيد.");
    if (reversalDate < period.startsAt || reversalDate > period.endsAt) throw new Error("يجب أن يقع تاريخ العكس داخل الفترة المالية المفتوحة.");
    const sourceLines = await tx.select().from(journalLines).where(and(eq(journalLines.organizationId, organizationId), eq(journalLines.journalEntryId, source.id)));
    assertBalancedJournal(sourceLines.map(line => ({ debit: Number(line.debit), credit: Number(line.credit) })));
    const reversal = await tx.insert(journalEntries).values({ organizationId, journalId: source.journalId, fiscalPeriodId: reversalPeriodId, journalNumber: entryNumber(), entryDate: reversalDate, currencyCode: source.currencyCode, exchangeRateSnapshot: source.exchangeRateSnapshot, reference: `REV-${source.journalNumber}`, description: note?.trim() || `عكس القيد ${source.journalNumber}`, sourceModule: "accounting", sourceDocumentType: "journal_reversal", sourceDocumentId: source.id, status: "posted", postedByUserId: actorUserId, postedAt: new Date() });
    const reversalId = Number(reversal[0].insertId);
    await tx.insert(journalLines).values(sourceLines.map(line => ({ organizationId, journalEntryId: reversalId, accountId: line.accountId, debit: line.credit, credit: line.debit, currencyCode: line.currencyCode, baseCurrencyAmount: line.baseCurrencyAmount, branchId: line.branchId, costCenterId: line.costCenterId, partyId: line.partyId, description: `عكس: ${line.description ?? ""}` })));
    await tx.update(journalEntries).set({ status: "reversed", reversedEntryId: reversalId }).where(and(eq(journalEntries.id, source.id), eq(journalEntries.organizationId, organizationId), eq(journalEntries.status, "posted")));
    await tx.insert(auditLogs).values({ organizationId, actorUserId, action: "accounting.journal_entry_reversed", entityType: "journal_entry", entityId: String(source.id), metadata: { reversalEntryId: reversalId, reversalPeriodId } });
    return { id: reversalId, sourceId: source.id, status: "posted" as const };
  });
}

export async function getAccountBalance(organizationId: number, accountId: number, input?: { startsAt?: Date; endsAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const predicates = [eq(journalLines.organizationId, organizationId), eq(journalLines.accountId, accountId), eq(journalEntries.organizationId, organizationId), inArray(journalEntries.status, ["posted", "reversed"])];
  if (input?.startsAt) predicates.push(gte(journalEntries.entryDate, input.startsAt));
  if (input?.endsAt) predicates.push(lte(journalEntries.entryDate, input.endsAt));
  const [balance] = await db.select({ debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`, credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId)).where(and(...predicates));
  return { debit: Number(balance?.debit ?? 0), credit: Number(balance?.credit ?? 0), net: Number(balance?.debit ?? 0) - Number(balance?.credit ?? 0) };
}

export async function listChartOfAccounts(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(chartOfAccounts).where(eq(chartOfAccounts.organizationId, organizationId)).orderBy(asc(chartOfAccounts.code));
}

export async function listJournalEntries(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  return db.select().from(journalEntries).where(eq(journalEntries.organizationId, organizationId)).orderBy(sql`${journalEntries.entryDate} desc`, sql`${journalEntries.id} desc`).limit(100);
}

export async function listFinanceSetup(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [journals, years, periods] = await Promise.all([
    db.select().from(accountingJournals).where(eq(accountingJournals.organizationId, organizationId)).orderBy(asc(accountingJournals.code)),
    db.select().from(fiscalYears).where(eq(fiscalYears.organizationId, organizationId)).orderBy(sql`${fiscalYears.startsAt} desc`),
    db.select().from(fiscalPeriods).where(eq(fiscalPeriods.organizationId, organizationId)).orderBy(sql`${fiscalPeriods.startsAt} desc`),
  ]);
  return { journals, years, periods };
}

export async function resolveAccountingMapping(organizationId: number, mappingKey: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [mapping] = await db.select().from(accountingMappings).where(and(eq(accountingMappings.organizationId, organizationId), eq(accountingMappings.mappingKey, mappingKey), eq(accountingMappings.status, "active"))).limit(1);
  if (!mapping) throw new Error(`لا توجد مطابقة حسابية نشطة للمفتاح ${mappingKey}.`);
  const accountIds = [mapping.debitAccountId, mapping.creditAccountId, mapping.taxAccountId].filter((id): id is number => Boolean(id));
  const accounts = await db.select({ id: chartOfAccounts.id, status: chartOfAccounts.status }).from(chartOfAccounts).where(and(eq(chartOfAccounts.organizationId, organizationId), inArray(chartOfAccounts.id, accountIds)));
  if (accounts.length !== accountIds.length || accounts.some(account => account.status !== "active")) throw new Error("تحتوي المطابقة الحسابية على حساب غير نشط أو خارج المؤسسة.");
  return mapping;
}

export async function resolvePostingContext(organizationId: number, journalCode: string, entryDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [[journal], [period]] = await Promise.all([
    db.select().from(accountingJournals).where(and(eq(accountingJournals.organizationId, organizationId), eq(accountingJournals.code, journalCode), eq(accountingJournals.status, "active"))).limit(1),
    db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.organizationId, organizationId), eq(fiscalPeriods.status, "open"), lte(fiscalPeriods.startsAt, entryDate), gte(fiscalPeriods.endsAt, entryDate))).limit(1),
  ]);
  if (!journal) throw new Error(`لا يوجد دفتر محاسبي نشط بالرمز ${journalCode}.`);
  if (!period) throw new Error("لا توجد فترة مالية مفتوحة تحتوي تاريخ الحدث التشغيلي.");
  return { journal, period };
}
