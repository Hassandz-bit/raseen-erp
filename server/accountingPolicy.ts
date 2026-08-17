export type JournalStatus = "draft" | "posted" | "reversed" | "cancelled";
export type FiscalPeriodStatus = "open" | "closed" | "locked";
export type AccountingLineInput = { debit: number; credit: number };

const cents = (value: number) => Math.round(value * 100);

export function assertBalancedJournal(lines: AccountingLineInput[]) {
  if (lines.length < 2) throw new Error("يتطلب القيد سطرين على الأقل.");
  const debit = lines.reduce((sum, line) => sum + cents(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + cents(line.credit), 0);
  if (debit <= 0 || credit <= 0 || debit !== credit) throw new Error("يجب أن يتساوى إجمالي المدين مع إجمالي الدائن وأن يكونا أكبر من صفر.");
  if (lines.some(line => (line.debit > 0 && line.credit > 0) || (line.debit < 0 || line.credit < 0))) throw new Error("يحتوي كل سطر على مدين أو دائن واحد موجب فقط.");
}

export function assertPostableJournal(status: JournalStatus, periodStatus: FiscalPeriodStatus) {
  if (status !== "draft") throw new Error("لا يمكن ترحيل قيد ليس في حالة مسودة.");
  if (periodStatus !== "open") throw new Error("لا يمكن الترحيل إلى فترة مالية مغلقة أو محجوبة.");
}

export function assertReversibleJournal(status: JournalStatus) {
  if (status !== "posted") throw new Error("لا يمكن عكس قيد غير مرحّل.");
}
