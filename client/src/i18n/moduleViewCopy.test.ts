import { describe, expect, it } from "vitest";
import { moduleViewCopy } from "./moduleViewCopy";

describe("moduleViewCopy", () => {
  it("يحافظ على مفاتيح ومحتوى الوحدات التفصيلية في اللغات الثلاث", () => {
    const languages = ["ar", "fr", "en"] as const;
    const baseline = Object.keys(moduleViewCopy.ar).sort();
    for (const language of languages) {
      expect(Object.keys(moduleViewCopy[language]).sort()).toEqual(baseline);
      for (const section of baseline as Array<keyof typeof moduleViewCopy.ar>) {
        const copy = moduleViewCopy[language][section];
        expect(copy.title.trim()).not.toBe("");
        expect(copy.detail.trim()).not.toBe("");
        expect(copy.stat.trim()).not.toBe("");
        expect(copy.action.trim()).not.toBe("");
      }
    }
  });
});
