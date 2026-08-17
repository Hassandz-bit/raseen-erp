import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const b2bSource = readFileSync(resolve(process.cwd(), "server/b2b.ts"), "utf8");
const contractSource = readFileSync(resolve(process.cwd(), "server/erp.ts"), "utf8");

describe("B2B Retail access isolation guardrails", () => {
  it("لا يسمح للوصول سوى بالمستخدم صاحب علاقة وصول نشطة وعميل ومورد نشطين", () => {
    expect(b2bSource).toContain("eq(b2bRetailerAccesses.userId, userId)");
    expect(b2bSource).toContain("eq(b2bRetailerAccesses.status, \"active\")");
    expect(b2bSource).toContain("eq(organizations.status, \"active\")");
    expect(b2bSource).toContain("eq(businessParties.status, \"active\")");
  });

  it("يقيد الكتالوج والطلب والمستندات بعلاقة الوصول بدلاً من معرف مؤسسة من المتصفح", () => {
    expect(contractSource).toContain("catalog: protectedProcedure.input(z.object({ accessId:");
    expect(contractSource).toContain("documents: protectedProcedure.input(z.object({ accessId:");
    expect(contractSource).toContain("createRetailerOrder(ctx.user.id, input.accessId, input)");
    expect(contractSource).not.toContain("catalog: protectedProcedure.input(z.object({ organizationId:");
  });

  it("يحصر المفضلة والملخص والمنتجات المتكررة بعلاقة الوصول الموثقة", () => {
    expect(b2bSource).toContain("toggleRetailerFavorite(userId: number, accessId: number");
    expect(b2bSource).toContain("getRetailerSummary(userId: number, accessId: number)");
    expect(b2bSource).toContain("getRetailerFrequentProducts(userId: number, accessId: number)");
    expect(b2bSource).toContain("const access = await requireRetailerAccess(userId, accessId);");
  });

  it("يحل السعر والعروض داخل الخادم ولا يقبل سعر المنتج من عقد إنشاء الطلب", () => {
    expect(b2bSource).toContain("const basePrice = Number(matchingItem?.price ?? product.salePrice)");
    expect(b2bSource).toContain("!item.customerId || item.customerId === access.customer.id");
    expect(b2bSource).toContain("!item.customerSegment || item.customerSegment === access.access.customerSegment");
    expect(b2bSource).toContain("!item.territoryId || item.territoryId === access.access.territoryId");
    expect(contractSource).toContain("lines: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().positive(), unit:");
    expect(contractSource).not.toContain("accessId: z.number().int().positive(), unitPrice:");
  });
});
