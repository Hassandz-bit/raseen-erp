import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { organizations, productCategories, products } from "../drizzle/schema";
import { createProductCategoryForOrganization, createProductMaster, getDb, listProductCategoriesForOrganization, listProductsForOrganization } from "./db";

let organizationIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const organizationId of organizationIds) {
    await db.delete(products).where(eq(products.organizationId, organizationId));
    await db.delete(productCategories).where(eq(productCategories.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  organizationIds = [];
});

describe("فئات المنتجات المعزولة", () => {
  it("تحصر الفئات في المؤسسة وتربط المنتج بفئته وترفض فئة مؤسسة أخرى", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = await db.insert(organizations).values({ name: `فئات أولى ${suffix}`, slug: `categories-first-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const second = await db.insert(organizations).values({ name: `فئات ثانية ${suffix}`, slug: `categories-second-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const firstOrganizationId = Number(first[0].insertId);
    const secondOrganizationId = Number(second[0].insertId);
    organizationIds = [firstOrganizationId, secondOrganizationId];
    const firstCategory = await createProductCategoryForOrganization(firstOrganizationId, { name: `مشروبات ${suffix}` });
    const foreignCategory = await createProductCategoryForOrganization(secondOrganizationId, { name: `فئة أجنبية ${suffix}` });

    await expect(createProductCategoryForOrganization(firstOrganizationId, { name: `فرع أجنبي ${suffix}`, parentId: foreignCategory.id })).rejects.toThrow("الفئة الرئيسية لا تنتمي");
    await expect(createProductMaster(firstOrganizationId, { sku: `FOREIGN-${suffix}`, name: "منتج بفئة أجنبية", categoryId: foreignCategory.id, productType: "standard", baseUnit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", unitsPerCarton: 1, purchasePrice: 0, salePrice: 10, taxRate: 0, minimumStock: 0, reorderPoint: 0 })).rejects.toThrow("الفئة المختارة لا تنتمي");

    await createProductMaster(firstOrganizationId, { sku: `LOCAL-${suffix}`, name: "مياه معدنية", categoryId: firstCategory.id, productType: "standard", baseUnit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", unitsPerCarton: 1, purchasePrice: 0, salePrice: 10, taxRate: 0, minimumStock: 0, reorderPoint: 0 });
    const firstCategories = await listProductCategoriesForOrganization(firstOrganizationId);
    const firstProducts = await listProductsForOrganization(firstOrganizationId);
    const secondCategories = await listProductCategoriesForOrganization(secondOrganizationId);
    expect(firstCategories.map(category => category.id)).toContain(firstCategory.id);
    expect(firstCategories.map(category => category.id)).not.toContain(foreignCategory.id);
    expect(secondCategories.map(category => category.id)).toContain(foreignCategory.id);
    expect(firstProducts).toEqual(expect.arrayContaining([expect.objectContaining({ sku: `LOCAL-${suffix}`, categoryId: firstCategory.id, categoryName: `مشروبات ${suffix}` })]));
  }, 20_000);
});
