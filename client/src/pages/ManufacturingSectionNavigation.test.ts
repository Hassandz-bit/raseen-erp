import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getPortal } from "@/config/nawaPortals";

const sectionPage = readFileSync(resolve(process.cwd(), "client/src/pages/ManufacturingSection.tsx"), "utf8");

describe("صفحات جداول التصنيع", () => {
  it("يعرض جداول التفاصيل من عقد أمر الإنتاج الرسمي", () => {
    expect(sectionPage).toContain("manufacturing.orderDetails");
    ["reservations", "stages", "outputs", "expenses"].forEach(field => expect(sectionPage).toContain(field));
  });

  it("يربط أدوات التصنيع بصفحات جداول مستقلة", () => {
    const entries = getPortal("manufacturing")?.localNavigation ?? [];
    ["/manufacturing/orders", "/manufacturing/materials", "/manufacturing/consumption", "/manufacturing/stages", "/manufacturing/output", "/manufacturing/quality", "/manufacturing/costs", "/manufacturing/traceability"].forEach(route => expect(entries.some(item => item.href === route)).toBe(true));
  });
});
