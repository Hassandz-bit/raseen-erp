import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getPortal } from "@/config/nawaPortals";

const commercePage = readFileSync(resolve(process.cwd(), "client/src/pages/CommerceInventory.tsx"), "utf8");
const operationsPanel = readFileSync(resolve(process.cwd(), "client/src/components/CommerceOperationsPanel.tsx"), "utf8");

describe("تنقل بوابة التجارة والمخزون", () => {
  it("يعرض جميع أدوات التجارة والمخزون التشغيلية", () => {
    const ids = getPortal("commerce")?.localNavigation.map(item => item.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining(["products", "warehouses", "batches", "sales", "purchases"]));
  });

  it("يربط الأدوات بمراسي الصفحة والأقسام المقابلة", () => {
    expect(commercePage).toContain("scrollIntoView");
    ["warehouses", "batches", "sales", "purchases"].forEach(id => expect(operationsPanel).toContain(`id=\"${id}\"`));
  });
});
