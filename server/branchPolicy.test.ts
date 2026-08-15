import { describe, expect, it } from "vitest";
import { classifyBranchPersistenceError } from "./branchPolicy";

describe("branchPolicy", () => {
  it("يصنف تكرار الرمز كتعارض ويحافظ على فشل الحفظ العام كحالة مستقلة", () => {
    expect(classifyBranchPersistenceError({ code: "ER_DUP_ENTRY" })).toBe("conflict");
    expect(classifyBranchPersistenceError({ code: "ECONNRESET" })).toBe("save_failed");
    expect(classifyBranchPersistenceError(new Error("unavailable"))).toBe("save_failed");
  });
});
