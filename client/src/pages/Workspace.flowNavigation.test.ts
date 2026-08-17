import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Workspace.tsx"), "utf8");

describe("Nawa Flow داخل مساحة Nawa AI", () => {
  it("يقدم Flow كعرض عمليات فرعي داخل واجهة الذكاء الاصطناعي", () => {
    expect(source).toContain('href="/workspace?view=nawa_flow"');
    expect(source).toContain('Nawa Flow ·');
  });
});
