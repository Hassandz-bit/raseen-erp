import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Workspace.tsx"), "utf8");

describe("مساحة العمل ضمن بوابات Nawa", () => {
  it("تحتفظ بـ Nawa AI وNawa Flow فقط", () => {
    expect(source).toContain("AIChatBox");
    expect(source).toContain("NawaFlow");
    expect(source).not.toContain("OperationsPanel");
    expect(source).not.toContain("OperationalOverview");
    expect(source).not.toContain("CommerceDocumentsPanel");
  });

  it("يبقي تحليل الذكاء الاصطناعي محكوماً ولا ينفذ إجراء تلقائياً", () => {
    expect(source).toContain("analysis_domain");
    expect(source).toContain("noAutoAction");
    expect(source).toContain("proposedAction");
  });
});
