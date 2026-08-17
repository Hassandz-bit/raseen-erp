import { describe, expect, it } from "vitest";
import { exceedsRetailCreditLimit } from "./b2b";

describe("Retail checkout credit policy", () => {
  it("يأخذ الذمم المفتوحة في الاعتبار قبل قبول طلب جديد", () => {
    expect(exceedsRetailCreditLimit(1_000, 850, 151)).toBe(true);
    expect(exceedsRetailCreditLimit(1_000, 850, 150)).toBe(false);
  });

  it("لا يفرض حد ائتماني عندما لا تكون المؤسسة قد حددته", () => {
    expect(exceedsRetailCreditLimit(0, 5_000, 500)).toBe(false);
  });
});
