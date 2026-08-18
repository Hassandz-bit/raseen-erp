import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("سياسة الإجراء الجماعي للدفعات", () => {
  const source = readFileSync(new URL("./erp.ts", import.meta.url), "utf8");

  it("لا يعرّف تحديث الحالة الجماعي إلا تحت حارس مالك المؤسسة", () => {
    expect(source).toMatch(/bulkUpdateBatchStatus:[\s\S]*?requireOrganizationOwner\(ctx\.user\.id\)/);
    expect(source).toMatch(/bulkUpdateBatchStatus:[\s\S]*?updateProductBatchStatus/);
  });

  it("يكشف قدرة الواجهة من دور العضوية الفعلي لا من افتراض متصفح", () => {
    expect(source).toMatch(/batchBulkCapabilities:[\s\S]*?isOrganizationOwner\(context\.membership\.roleKey\)/);
  });
});
