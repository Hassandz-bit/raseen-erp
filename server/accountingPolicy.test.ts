import { describe, expect, it } from "vitest";
import { assertBalancedJournal, assertPostableJournal, assertReversibleJournal } from "./accountingPolicy";

describe("سياسة القيود المحاسبية", () => {
  it("تقبل القيد المتوازن وتمنع غير المتوازن", () => {
    expect(() => assertBalancedJournal([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }])).not.toThrow();
    expect(() => assertBalancedJournal([{ debit: 100, credit: 0 }, { debit: 0, credit: 99.99 }])).toThrow(/يتساوى/);
  });
  it("تمنع الترحيل إلى فترة مغلقة وتسمح بالعكس بعد الترحيل فقط", () => {
    expect(() => assertPostableJournal("draft", "open")).not.toThrow();
    expect(() => assertPostableJournal("draft", "closed")).toThrow(/مغلقة/);
    expect(() => assertReversibleJournal("posted")).not.toThrow();
    expect(() => assertReversibleJournal("draft")).toThrow(/غير مرحّل/);
  });
});
