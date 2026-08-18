import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/erp.ts"), "utf8");

describe("سياسة الفروع المتاحة للرأس", () => {
  it("يشتق المؤسسة ونطاق الفروع من العضوية ولا يقبل مدخلات من المتصفح", () => {
    expect(source).toContain("availableBranches: protectedProcedure.query");
    expect(source).toContain("const context = await getTenantContext(ctx.user.id)");
    expect(source).toContain("context.membership.dataScope?.branchIds ?? []");
    expect(source).toContain('branch.status === "active"');
    expect(source).toContain("allowedBranchIds.includes(branch.id)");
    expect(source).not.toContain("availableBranches: protectedProcedure.input");
  });
});
