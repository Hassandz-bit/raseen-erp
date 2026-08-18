import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, b2bPromotions, branches, businessParties, demoSeedRuns, distributionRoutes, fleetVehicles, manufacturingBoms, organizationMemberships, organizationModules, organizationRoles, organizationSettings, organizations, priceListItems, priceLists, productBatches, productBrands, productCategories, productPackagingLevels, productUnitConversions, products, productionOrders, purchaseOrderItems, purchaseOrders, salesInvoices, uomCatalog, userPreferences, vehicleLoadItems, warehouses } from "../drizzle/schema";
import { createBusinessParty, createProductBatch, createPurchaseOrder, createSalesInvoice, defaultDocumentSettings, getDb, issueSalesInvoiceWithFefo, receivePurchaseOrder, recordSalesInvoicePayment, sendPurchaseOrder, setActiveOrganizationForUser } from "./db";
import { createDistributionRoute, createDistributionTerritory, createFleetVehicle, createVehicleLoadOrder, logFuel, recordDistributionCollection, recordDistributionDelivery, transitionDistributionRoute, transitionVehicleLoadOrder } from "./distribution";
import { createManufacturingBom, createProductionOrder, issueMaterialsForProduction, recordProductionExpense, recordProductionOutput, recordProductionQualityCheck, recordProductionWaste, reserveProductionMaterials, saveManufacturingProductProfile, transitionProductionOrderStatus } from "./manufacturing";
import { productionExpenses, productionOutputs } from "../drizzle/manufacturingSchema";

export const DEMO_ORGANIZATION = {
  slug: "nawa-demo",
  name: "شركة نواة للتوزيع والصناعات",
  datasetVersion: "2026.08.1",
  moduleKeys: ["inventory", "sales", "purchases", "finance", "hr", "reports", "ai_assistant", "distribution", "manufacturing", "nawa_retail"],
} as const;

const DEMO_BRANCHES = [
  { code: "DEMO-HQ", name: "الإدارة المركزية — الجزائر" },
  { code: "DEMO-EAST", name: "فرع الشرق" },
  { code: "DEMO-SOUTH", name: "فرع الجنوب" },
] as const;

const DEMO_WAREHOUSES = [
  { code: "DEMO-CENTRAL", name: "المستودع المركزي", branchCode: "DEMO-HQ" },
  { code: "DEMO-FG", name: "مستودع المنتجات الجاهزة", branchCode: "DEMO-HQ" },
  { code: "DEMO-RM", name: "مستودع المواد الأولية", branchCode: "DEMO-HQ" },
  { code: "DEMO-EAST", name: "مستودع فرع الشرق", branchCode: "DEMO-EAST" },
] as const;

const DEMO_ROLES = [
  ["owner", "مالك Demo", ["*"]], ["general_manager", "مدير عام", ["reports.view", "sales.view", "finance.view", "distribution.view"]], ["sales_manager", "مدير مبيعات", ["sales.*", "customer.*", "price.*"]], ["sales_representative", "مندوب مبيعات", ["sales.create", "sales.view", "customer.view"]], ["warehouse_manager", "مدير مخزن", ["inventory.*", "warehouse.view"]], ["warehouse_clerk", "أمين مخزن", ["inventory.view", "inventory.count", "inventory.transfer"]], ["procurement_manager", "مدير مشتريات", ["purchases.*", "supplier.*"]], ["finance_manager", "مدير مالي", ["finance.*", "treasury.*"]], ["accountant", "محاسب", ["finance.view", "finance.journal.post", "treasury.view"]], ["production_manager", "مدير إنتاج", ["manufacturing.*", "quality.*"]], ["quality_officer", "مسؤول جودة", ["quality.*", "manufacturing.view"]], ["distribution_manager", "مدير توزيع", ["distribution.*", "fleet.*"]], ["driver", "سائق", ["driver.route.view", "driver.delivery.complete"]], ["hr_manager", "مدير موارد بشرية", ["hr.*", "payroll.*"]],
] as const;

const DEMO_CATALOG = [
  ["DEMO-001", "حليب نواة كامل الدسم 1 لتر", "Nawa Full Cream Milk 1L", "الألبان", "نواة", "food", 105, 145, 12], ["DEMO-002", "حليب نواة نصف الدسم 1 لتر", "Nawa Semi-Skimmed Milk 1L", "الألبان", "نواة", "food", 100, 140, 12], ["DEMO-003", "لبن نواة طبيعي 170غ", "Nawa Natural Yogurt 170g", "الألبان", "نواة", "food", 42, 62, 24], ["DEMO-004", "جبن نواة قابل للدهن 250غ", "Nawa Spread Cheese 250g", "الألبان", "نواة", "food", 175, 235, 12],
  ["DEMO-005", "عصير نواة برتقال 1 لتر", "Nawa Orange Juice 1L", "المشروبات", "نواة", "food", 95, 135, 12], ["DEMO-006", "عصير نواة كوكتيل 1 لتر", "Nawa Cocktail Juice 1L", "المشروبات", "نواة", "food", 95, 135, 12], ["DEMO-007", "مياه نواة 1.5 لتر", "Nawa Water 1.5L", "المشروبات", "نواة", "standard", 25, 40, 6],
  ["DEMO-008", "قهوة أطلس مطحونة 250غ", "Atlas Ground Coffee 250g", "البقالة", "أطلس", "standard", 210, 295, 12], ["DEMO-009", "سكر الواحة 1 كلغ", "Oasis Sugar 1kg", "البقالة", "الواحة", "standard", 92, 125, 10], ["DEMO-010", "أرز الواحة طويل 1 كلغ", "Oasis Long Rice 1kg", "البقالة", "الواحة", "standard", 130, 175, 10], ["DEMO-011", "معكرونة أطلس 500غ", "Atlas Pasta 500g", "البقالة", "أطلس", "standard", 55, 80, 20], ["DEMO-012", "طماطم معلبة أطلس 400غ", "Atlas Tomato 400g", "البقالة", "أطلس", "standard", 62, 88, 24], ["DEMO-013", "زيت نباتي الندى 1 لتر", "Nada Vegetable Oil 1L", "البقالة", "الندى", "standard", 215, 285, 12], ["DEMO-014", "شاي الصحراء 25 كيس", "Sahara Tea 25 Bags", "البقالة", "الصحراء", "standard", 85, 120, 12],
  ["DEMO-015", "صابون نقي 1 كلغ", "Naki Detergent 1kg", "العناية المنزلية", "نقي", "standard", 160, 230, 8], ["DEMO-016", "سائل أطباق نقي 750مل", "Naki Dish Liquid 750ml", "العناية المنزلية", "نقي", "standard", 105, 155, 12], ["DEMO-017", "مناديل نقي 200 ورقة", "Naki Tissues 200", "العناية المنزلية", "نقي", "standard", 120, 170, 10], ["DEMO-018", "مطهر الندى 1 لتر", "Nada Disinfectant 1L", "العناية المنزلية", "الندى", "standard", 145, 205, 12],
  ["DEMO-019", "شامبو لمسة 400مل", "Lamsa Shampoo 400ml", "العناية الشخصية", "لمسة", "standard", 185, 260, 12], ["DEMO-020", "صابون يدين لمسة 500مل", "Lamsa Hand Soap 500ml", "العناية الشخصية", "لمسة", "standard", 90, 135, 12], ["DEMO-021", "معجون أسنان لمسة 100مل", "Lamsa Toothpaste 100ml", "العناية الشخصية", "لمسة", "standard", 75, 110, 24],
  ["DEMO-022", "بسكويت بهجة 100غ", "Bahja Biscuits 100g", "الوجبات الخفيفة", "بهجة", "food", 35, 55, 48], ["DEMO-023", "رقائق بهجة 90غ", "Bahja Chips 90g", "الوجبات الخفيفة", "بهجة", "food", 48, 70, 36], ["DEMO-024", "شوكولاتة بهجة 45غ", "Bahja Chocolate 45g", "الوجبات الخفيفة", "بهجة", "food", 55, 82, 30],
  ["DEMO-025", "دقيق أطلس 1 كلغ", "Atlas Flour 1kg", "المواد الأولية", "أطلس", "manufacturable", 68, 95, 10], ["DEMO-026", "سكر أبيض خام 25 كلغ", "Raw White Sugar 25kg", "المواد الأولية", "الواحة", "manufacturable", 1900, 2400, 1], ["DEMO-027", "عبوة PET 1 لتر", "PET Bottle 1L", "مواد التعبئة", "نواة", "manufacturable", 18, 28, 100], ["DEMO-028", "غطاء عبوة أبيض", "White Bottle Cap", "مواد التعبئة", "نواة", "manufacturable", 3, 6, 500], ["DEMO-029", "ملصق نواة 1 لتر", "Nawa Label 1L", "مواد التعبئة", "نواة", "manufacturable", 2, 5, 500], ["DEMO-030", "كرتون شحن 12 وحدة", "Shipping Carton 12 Units", "مواد التعبئة", "نواة", "manufacturable", 45, 65, 20],
] as const;

const DEMO_PARTIES = [
  ["SUP-001", "شركة الأطلس للمواد الغذائية", ["supplier"], "مورد مواد غذائية رئيسي", 30, 0], ["SUP-002", "مصانع الندى للتعبئة", ["supplier"], "مورد عبوات وتغليف", 45, 0], ["SUP-003", "تعاونية الواحة الزراعية", ["supplier"], "مورد مواد أولية", 30, 0], ["SUP-004", "مؤسسة الصحراء للشاي", ["supplier"], "مورد مشروبات ساخنة", 30, 0], ["SUP-005", "شركة لمسة للعناية", ["supplier"], "مورد عناية شخصية", 60, 0], ["SUP-006", "مصنع نقي للمنظفات", ["supplier"], "مورد عناية منزلية", 45, 0], ["SUP-007", "مورد محلي قيد التقييم", ["supplier"], "مورد احتياطي", 30, 0], ["SUP-008", "شركة الأمل للنقل", ["supplier"], "خدمات خارجية", 30, 0],
  ["CUS-001", "سوبرماركت السعادة", ["customer"], "عميل VIP", 30, 750000], ["CUS-002", "متاجر النجاح", ["customer"], "عميل جملة", 21, 500000], ["CUS-003", "بقالة الأمان", ["customer"], "عميل نقدي", 0, 100000], ["CUS-004", "سوق الشرق المركزي", ["customer"], "عميل جملة", 30, 450000], ["CUS-005", "ميني ماركت الود", ["customer"], "عميل نقدي", 0, 75000], ["CUS-006", "توزيع الجنوب", ["customer"], "عميل موزع", 45, 950000], ["CUS-007", "هايبر ماركت المدينة", ["customer"], "عميل VIP", 30, 800000], ["CUS-008", "متجر العائلة", ["customer"], "عميل جملة", 15, 200000], ["CUS-009", "نقطة بيع الربيع", ["customer"], "عميل تجزئة", 0, 90000], ["CUS-010", "مؤسسة الشروق", ["customer"], "عميل جملة", 30, 360000], ["CUS-011", "متجر الوردة", ["customer"], "عميل تجزئة", 0, 85000], ["CUS-012", "مخزن الوفاق", ["customer"], "عميل موزع", 45, 700000], ["CUS-013", "بقالة النخبة", ["customer"], "عميل جملة", 15, 180000], ["CUS-014", "سوبر ماركت الأمل", ["customer"], "عميل VIP", 30, 600000], ["CUS-015", "متجر النور", ["customer"], "عميل تجزئة", 0, 80000], ["CUS-016", "نقطة توزيع الساحل", ["customer"], "عميل موزع", 45, 550000],
] as const;

const DEMO_PRICE_LISTS = [
  ["Retail DZD", "retail", 100, 1], ["Wholesale DZD", "wholesale", 80, 0.9], ["Distributor DZD", "segment", 70, 0.84], ["VIP DZD", "customer", 60, 0.8],
] as const;

export async function ensureDemoOrganization(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const organizationId = await db.transaction(async tx => {
    const [existing] = await tx.select().from(organizations).where(eq(organizations.slug, DEMO_ORGANIZATION.slug)).limit(1);
    if (existing && existing.isDemo !== "yes") throw new Error("معرف شركة العرض محجوز لمؤسسة غير تجريبية.");
    const id = existing?.id ?? Number((await tx.insert(organizations).values({
      name: DEMO_ORGANIZATION.name,
      slug: DEMO_ORGANIZATION.slug,
      status: "active",
      isDemo: "yes",
      baseCurrency: "DZD",
      locale: "ar-DZ",
      monthlyBudget: "0",
    }))[0].insertId);

    const now = new Date();
    await tx.insert(organizationMemberships).values({ organizationId: id, userId: actorUserId, roleKey: "owner", status: "active", createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { roleKey: "owner", status: "active", updatedAt: now } });
    for (const [key, name, permissions] of DEMO_ROLES) {
      await tx.insert(organizationRoles).values({ organizationId: id, key, name, description: `دور ${name} ضمن شركة العرض المعزولة.`, permissions: [...permissions] }).onDuplicateKeyUpdate({ set: { name, description: `دور ${name} ضمن شركة العرض المعزولة.`, permissions: [...permissions] } });
    }
    await tx.insert(organizationModules).values(DEMO_ORGANIZATION.moduleKeys.map(moduleKey => ({ organizationId: id, moduleKey, status: "active" as const, changeSource: "demo_seed" }))).onDuplicateKeyUpdate({ set: { status: "active", changeSource: "demo_seed" } });
    await tx.insert(organizationSettings).values({ organizationId: id, currencyCode: "DZD", timeZone: "Africa/Algiers", documentSettings: { ...defaultDocumentSettings, headerText: "بيانات تجريبية — Nawa Demo" } }).onDuplicateKeyUpdate({ set: { currencyCode: "DZD", timeZone: "Africa/Algiers" } });
    await tx.insert(demoSeedRuns).values({ organizationId: id, datasetVersion: DEMO_ORGANIZATION.datasetVersion, status: "ready", lastActionByUserId: actorUserId }).onDuplicateKeyUpdate({ set: { datasetVersion: DEMO_ORGANIZATION.datasetVersion, status: "ready", lastActionByUserId: actorUserId } });
    return id;
  });

  await setActiveOrganizationForUser(actorUserId, organizationId);
  return { organizationId, slug: DEMO_ORGANIZATION.slug, name: DEMO_ORGANIZATION.name };
}

export async function getDemoOrganizationForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const rows = await db.select({ organization: organizations, membership: organizationMemberships, seedRun: demoSeedRuns })
    .from(organizations)
    .innerJoin(organizationMemberships, and(eq(organizationMemberships.organizationId, organizations.id), eq(organizationMemberships.userId, userId), eq(organizationMemberships.status, "active")))
    .leftJoin(demoSeedRuns, eq(demoSeedRuns.organizationId, organizations.id))
    .where(and(eq(organizations.slug, DEMO_ORGANIZATION.slug), eq(organizations.isDemo, "yes")))
    .limit(1);
  return rows[0] ?? null;
}

export async function activateDemoOrganizationForUser(userId: number) {
  const demo = await getDemoOrganizationForUser(userId);
  if (!demo) throw new Error("شركة العرض غير متاحة لعضويتك.");
  await setActiveOrganizationForUser(userId, demo.organization.id);
  return demo.organization;
}

export async function seedDemoFoundation(actorUserId: number) {
  const demo = await ensureDemoOrganization(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  await db.update(demoSeedRuns).set({ status: "seeding", lastActionByUserId: actorUserId }).where(eq(demoSeedRuns.organizationId, demo.organizationId));
  try {
    for (const branch of DEMO_BRANCHES) {
      await db.insert(branches).values({ organizationId: demo.organizationId, ...branch, status: "active" }).onDuplicateKeyUpdate({ set: { name: branch.name, status: "active" } });
    }
    const seededBranches = await db.select().from(branches).where(eq(branches.organizationId, demo.organizationId));
    const branchIds = new Map(seededBranches.map(branch => [branch.code, branch.id]));
    for (const warehouse of DEMO_WAREHOUSES) {
      const branchId = branchIds.get(warehouse.branchCode);
      if (!branchId) throw new Error(`فرع Demo غير موجود للمستودع ${warehouse.code}.`);
      await db.insert(warehouses).values({ organizationId: demo.organizationId, branchId, code: warehouse.code, name: warehouse.name, status: "active", isMobile: "no" }).onDuplicateKeyUpdate({ set: { branchId, name: warehouse.name, status: "active" } });
    }
    await db.insert(auditLogs).values({ organizationId: demo.organizationId, actorUserId, action: "demo.foundation.seeded", entityType: "demo_seed", entityId: String(demo.organizationId), metadata: { branches: DEMO_BRANCHES.length, warehouses: DEMO_WAREHOUSES.length, datasetVersion: DEMO_ORGANIZATION.datasetVersion } });
    await db.update(demoSeedRuns).set({ status: "ready", seededAt: new Date(), lastActionByUserId: actorUserId }).where(eq(demoSeedRuns.organizationId, demo.organizationId));
  } catch (error) {
    await db.update(demoSeedRuns).set({ status: "failed", lastActionByUserId: actorUserId }).where(eq(demoSeedRuns.organizationId, demo.organizationId));
    throw error;
  }

  const warehousesCount = await db.select({ id: warehouses.id }).from(warehouses).where(eq(warehouses.organizationId, demo.organizationId));
  return { ...demo, branches: DEMO_BRANCHES.length, warehouses: warehousesCount.length };
}

export async function seedDemoCatalog(actorUserId: number) {
  const foundation = await seedDemoFoundation(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const organizationId = foundation.organizationId;
  const categoryNames = Array.from(new Set(DEMO_CATALOG.map(item => item[3])));
  const brandNames = Array.from(new Set(DEMO_CATALOG.map(item => item[4])));

  for (let index = 0; index < categoryNames.length; index += 1) {
    const name = categoryNames[index];
    await db.insert(productCategories).values({ organizationId, name, color: ["#D7B56D", "#62C8D3", "#8DD6A5", "#B7A5E6"][index % 4], status: "active" }).onDuplicateKeyUpdate({ set: { status: "active" } });
  }
  for (const name of brandNames) await db.insert(productBrands).values({ organizationId, name, status: "active" }).onDuplicateKeyUpdate({ set: { status: "active" } });
  await db.insert(uomCatalog).values([
    { code: "DEMO-UNIT", canonicalType: "piece", nameAr: "وحدة", nameFr: "Unité", nameEn: "Unit", status: "active" },
    { code: "DEMO-CARTON", canonicalType: "carton", nameAr: "كرتون", nameFr: "Carton", nameEn: "Carton", status: "active" },
  ]).onDuplicateKeyUpdate({ set: { status: "active" } });

  const categories = await db.select().from(productCategories).where(eq(productCategories.organizationId, organizationId));
  const brands = await db.select().from(productBrands).where(eq(productBrands.organizationId, organizationId));
  const categoryByName = new Map(categories.map(item => [item.name, item.id]));
  const brandByName = new Map(brands.map(item => [item.name, item.id]));
  const units = await db.select().from(uomCatalog).where(inArray(uomCatalog.code, ["DEMO-UNIT", "DEMO-CARTON"]));
  const unitByCode = new Map(units.map(item => [item.code, item.id]));

  for (let index = 0; index < DEMO_CATALOG.length; index += 1) {
    const item = DEMO_CATALOG[index];
    const [sku, nameAr, nameEn, categoryName, brandName, productType, purchasePrice, salePrice, unitsPerCarton] = item;
    await db.insert(products).values({ organizationId, sku, name: nameAr, nameAr, nameFr: nameEn, nameEn, barcode: `613${String(index + 1).padStart(10, "0")}`, categoryId: categoryByName.get(categoryName), brandId: brandByName.get(brandName), productType, baseUnit: "وحدة", unit: "وحدة", purchaseUnit: "كرتون", salesUnit: "وحدة", unitsPerCarton: String(unitsPerCarton), purchasePrice: String(purchasePrice), salePrice: String(salePrice), taxRate: "19", minimumStock: String(Math.max(12, unitsPerCarton * 2)), reorderPoint: String(Math.max(24, unitsPerCarton * 4)), netWeight: "0.8", grossWeight: "0.9", volume: "0.002", status: "active" }).onDuplicateKeyUpdate({ set: { name: nameAr, nameAr, nameFr: nameEn, nameEn, categoryId: categoryByName.get(categoryName), brandId: brandByName.get(brandName), productType, purchasePrice: String(purchasePrice), salePrice: String(salePrice), unitsPerCarton: String(unitsPerCarton), status: "active" } });
  }

  const catalog = await db.select().from(products).where(eq(products.organizationId, organizationId));
  for (const product of catalog) {
    const source = DEMO_CATALOG.find(item => item[0] === product.sku);
    if (!source) continue;
    const cartonFactor = source[8];
    await db.insert(productUnitConversions).values([{ organizationId, productId: product.id, fromUnit: "كرتون", toUnit: "وحدة", factor: String(cartonFactor) }, { organizationId, productId: product.id, fromUnit: "منصة", toUnit: "كرتون", factor: "48" }]).onDuplicateKeyUpdate({ set: { factor: sql`VALUES(factor)` } });
    await db.insert(productPackagingLevels).values([
      { organizationId, productId: product.id, uomId: unitByCode.get("DEMO-UNIT"), code: "UNIT", displayName: "وحدة", factorToBase: "1", barcode: `613${String(product.id).padStart(10, "0")}`, allowedPurchase: "no", allowedSales: "yes", allowedB2b: "yes", allowedDistribution: "yes", isDefaultSales: "yes", isDefaultB2b: "yes", isDefaultDistribution: "yes", status: "active" },
      { organizationId, productId: product.id, uomId: unitByCode.get("DEMO-CARTON"), code: "CARTON", displayName: "كرتون", factorToBase: String(cartonFactor), netWeightKg: String(cartonFactor * 0.8), grossWeightKg: String(cartonFactor * 0.9), cartonsPerPallet: "48", unitsPerPallet: String(cartonFactor * 48), allowedPurchase: "yes", allowedSales: "yes", allowedB2b: "yes", allowedDistribution: "yes", isDefaultPurchase: "yes", status: "active" },
    ]).onDuplicateKeyUpdate({ set: { status: "active", factorToBase: sql`VALUES(factorToBase)` } });
  }
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.catalog.seeded", entityType: "demo_seed", entityId: String(organizationId), metadata: { categories: categoryNames.length, brands: brandNames.length, products: DEMO_CATALOG.length } });
  return { organizationId, categories: categoryNames.length, brands: brandNames.length, products: DEMO_CATALOG.length };
}

export async function seedDemoCommercialMaster(actorUserId: number) {
  const catalog = await seedDemoCatalog(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const organizationId = catalog.organizationId;
  for (const [code, name, types, notes, paymentTermsDays, creditLimit] of DEMO_PARTIES) {
    const [existing] = await db.select({ id: businessParties.id }).from(businessParties).where(and(eq(businessParties.organizationId, organizationId), eq(businessParties.code, code))).limit(1);
    if (!existing) await createBusinessParty(organizationId, { code, name, types: [...types], contactName: "جهة اتصال تجريبية", phone: `0550${String(Math.abs(code.split("-")[1] as unknown as number) || 1).padStart(6, "0")}`, email: `${code.toLowerCase()}@demo.invalid`, paymentTermsDays, creditLimit, preferredCurrencyCode: "DZD", customerSegment: notes });
  }
  const productsForDemo = await db.select().from(products).where(eq(products.organizationId, organizationId));
  for (const [name, kind, priority, factor] of DEMO_PRICE_LISTS) {
    const [existing] = await db.select().from(priceLists).where(and(eq(priceLists.organizationId, organizationId), eq(priceLists.name, name))).limit(1);
    const listId = existing?.id ?? Number((await db.insert(priceLists).values({ organizationId, name, kind, priority, currencyCode: "DZD", status: "active" }))[0].insertId);
    for (const product of productsForDemo) {
      const retailPrice = Number(product.salePrice) * factor;
      await db.insert(priceListItems).values({ organizationId, priceListId: listId, productId: product.id, unit: "وحدة", price: retailPrice.toFixed(2), minimumQuantity: "1" }).onDuplicateKeyUpdate({ set: { price: retailPrice.toFixed(2), minimumQuantity: "1" } });
    }
  }
  const [centralWarehouse] = await db.select().from(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.code, "DEMO-CENTRAL"))).limit(1);
  const [supplier] = await db.select().from(businessParties).where(and(eq(businessParties.organizationId, organizationId), eq(businessParties.code, "SUP-001"))).limit(1);
  if (!centralWarehouse || !supplier) throw new Error("بيانات العرض الأساسية غير مكتملة للدفعات.");
  const foodProducts = productsForDemo.filter(product => product.productType === "food" || product.productType === "expiring").slice(0, 10);
  const relativeDays = [180, 120, 60, 25, 12, 5, -3, 90, 45, 15];
  for (let index = 0; index < foodProducts.length; index += 1) {
    const product = foodProducts[index];
    const lotNumber = `DEMO-LOT-${String(index + 1).padStart(3, "0")}`;
    const [existingBatch] = await db.select({ id: productBatches.id }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, centralWarehouse.id), eq(productBatches.lotNumber, lotNumber))).limit(1);
    if (existingBatch) continue;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + relativeDays[index]);
    const manufacturingDate = new Date(expiryDate);
    manufacturingDate.setDate(manufacturingDate.getDate() - 45);
    await createProductBatch(organizationId, { productId: product.id, warehouseId: centralWarehouse.id, lotNumber, receivedQuantity: 180 + index * 25, cost: Number(product.purchasePrice), sourcePartyId: supplier.id, manufacturingDate, expiryDate, status: relativeDays[index] < 0 ? "expired" : "active", movementType: "opening_balance", sourceDocumentType: "demo_seed" });
  }
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.commercial_master.seeded", entityType: "demo_seed", entityId: String(organizationId), metadata: { parties: DEMO_PARTIES.length, priceLists: DEMO_PRICE_LISTS.length, batches: foodProducts.length } });
  return { organizationId, parties: DEMO_PARTIES.length, priceLists: DEMO_PRICE_LISTS.length, batches: foodProducts.length };
}

export async function seedDemoPromotions(actorUserId: number) {
  const commercial = await seedDemoCommercialMaster(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const organizationId = commercial.organizationId;
  const demoProducts = await db.select().from(products).where(eq(products.organizationId, organizationId));
  const demoCustomers = await db.select().from(businessParties).where(eq(businessParties.organizationId, organizationId));
  const bySku = new Map(demoProducts.map(product => [product.sku, product]));
  const byCode = new Map(demoCustomers.map(party => [party.code, party]));
  const now = new Date();
  const activeUntil = new Date(now); activeUntil.setDate(activeUntil.getDate() + 18);
  const nearEnd = new Date(now); nearEnd.setDate(nearEnd.getDate() + 2);
  const expired = new Date(now); expired.setDate(expired.getDate() - 1);
  const promotions = [
    { name: "عرض إطلاق الحليب — خصم 12%", type: "percentage_discount" as const, productId: bySku.get("DEMO-001")?.id, discountPercentage: "12", startsAt: now, endsAt: activeUntil },
    { name: "سعر VIP على القهوة", type: "special_price" as const, productId: bySku.get("DEMO-008")?.id, customerId: byCode.get("CUS-001")?.id, specialPrice: "250", startsAt: now, endsAt: activeUntil },
    { name: "اشتر 10 واحصل على 1 بسكويت", type: "buy_x_get_y" as const, productId: bySku.get("DEMO-022")?.id, buyQuantity: "10", getQuantity: "1", startsAt: now, endsAt: nearEnd },
    { name: "عرض منتهٍ للعرض فقط", type: "fixed_discount" as const, productId: bySku.get("DEMO-015")?.id, discountAmount: "20", startsAt: expired, endsAt: expired },
  ];
  for (const promotion of promotions) {
    if (!promotion.productId) continue;
    const [existing] = await db.select({ id: b2bPromotions.id }).from(b2bPromotions).where(and(eq(b2bPromotions.organizationId, organizationId), eq(b2bPromotions.name, promotion.name))).limit(1);
    const values = { organizationId, name: promotion.name, status: promotion.endsAt < now ? "expired" as const : "active" as const, type: promotion.type, productId: promotion.productId, customerId: "customerId" in promotion ? promotion.customerId : undefined, minimumQuantity: "1", discountPercentage: "discountPercentage" in promotion ? promotion.discountPercentage : undefined, discountAmount: "discountAmount" in promotion ? promotion.discountAmount : undefined, specialPrice: "specialPrice" in promotion ? promotion.specialPrice : undefined, buyQuantity: "buyQuantity" in promotion ? promotion.buyQuantity : undefined, getQuantity: "getQuantity" in promotion ? promotion.getQuantity : undefined, startsAt: promotion.startsAt, endsAt: promotion.endsAt, visibleToB2b: "yes" as const, createdByUserId: actorUserId };
    if (existing) await db.update(b2bPromotions).set(values).where(eq(b2bPromotions.id, existing.id)); else await db.insert(b2bPromotions).values(values);
  }
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.promotions.seeded", entityType: "demo_seed", entityId: String(organizationId), metadata: { promotions: promotions.length } });
  return { ...commercial, promotions: promotions.length };
}

async function seedDemoInvoice(actorUserId: number, organizationId: number, input: { number: string; customerId: number; productId: number; warehouseId: number; quantity: number; dueDays: number; payment: "full" | "partial" | "none"; overdue?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [existing] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.invoiceNumber, input.number))).limit(1);
  if (existing) return existing.id;
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + input.dueDays);
  const created = await createSalesInvoice(organizationId, actorUserId, { invoiceNumber: input.number, customerId: input.customerId, currencyCode: "DZD", baseCurrencyCode: "DZD", dueDate, lines: [{ productId: input.productId, warehouseId: input.warehouseId, quantity: input.quantity }] });
  await issueSalesInvoiceWithFefo(organizationId, actorUserId, created.id);
  if (input.payment === "full") await recordSalesInvoicePayment(organizationId, actorUserId, created.id);
  if (input.payment === "partial") await recordSalesInvoicePayment(organizationId, actorUserId, created.id, Math.max(1, Math.round(created.grandTotal * 0.4)));
  if (input.overdue) {
    await db.update(salesInvoices).set({ status: "overdue" }).where(and(eq(salesInvoices.id, created.id), eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.status, "issued")));
    await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.sales_invoice.marked_overdue", entityType: "sales_invoice", entityId: String(created.id), metadata: { dueDate } });
  }
  return created.id;
}

export async function seedDemoCommerceScenarios(actorUserId: number) {
  const master = await seedDemoPromotions(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const organizationId = master.organizationId;
  const [centralWarehouse] = await db.select().from(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.code, "DEMO-CENTRAL"))).limit(1);
  const demoProducts = await db.select().from(products).where(eq(products.organizationId, organizationId));
  const parties = await db.select().from(businessParties).where(eq(businessParties.organizationId, organizationId));
  if (!centralWarehouse) throw new Error("المستودع المركزي لشركة العرض غير متاح.");
  const productBySku = new Map(demoProducts.map(product => [product.sku, product]));
  const partyByCode = new Map(parties.map(party => [party.code, party]));
  const must = <T>(value: T | undefined, label: string): T => { if (!value) throw new Error(`بيانات Demo ناقصة: ${label}`); return value; };
  await seedDemoInvoice(actorUserId, organizationId, { number: "INV-DEMO-PAID-001", customerId: must(partyByCode.get("CUS-001"), "CUS-001").id, productId: must(productBySku.get("DEMO-001"), "DEMO-001").id, warehouseId: centralWarehouse.id, quantity: 20, dueDays: -10, payment: "full" });
  await seedDemoInvoice(actorUserId, organizationId, { number: "INV-DEMO-PARTIAL-001", customerId: must(partyByCode.get("CUS-002"), "CUS-002").id, productId: must(productBySku.get("DEMO-002"), "DEMO-002").id, warehouseId: centralWarehouse.id, quantity: 18, dueDays: 7, payment: "partial" });
  await seedDemoInvoice(actorUserId, organizationId, { number: "INV-DEMO-OVERDUE-001", customerId: must(partyByCode.get("CUS-004"), "CUS-004").id, productId: must(productBySku.get("DEMO-003"), "DEMO-003").id, warehouseId: centralWarehouse.id, quantity: 14, dueDays: -18, payment: "none", overdue: true });

  const [existingPurchase] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, organizationId), eq(purchaseOrders.orderNumber, "PO-DEMO-PARTIAL-001"))).limit(1);
  if (!existingPurchase) {
    const expectedAt = new Date(); expectedAt.setDate(expectedAt.getDate() + 5);
    const purchase = await createPurchaseOrder(organizationId, actorUserId, { orderNumber: "PO-DEMO-PARTIAL-001", supplierId: must(partyByCode.get("SUP-003"), "SUP-003").id, currencyCode: "DZD", baseCurrencyCode: "DZD", expectedAt, lines: [{ productId: must(productBySku.get("DEMO-025"), "DEMO-025").id, warehouseId: centralWarehouse.id, quantity: 120, unit: "كرتون", unitCost: 68 }, { productId: must(productBySku.get("DEMO-027"), "DEMO-027").id, warehouseId: centralWarehouse.id, quantity: 300, unit: "وحدة", unitCost: 18 }] });
    await sendPurchaseOrder(organizationId, actorUserId, purchase.id);
    const items = await db.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, organizationId), eq(purchaseOrderItems.purchaseOrderId, purchase.id)));
    await receivePurchaseOrder(organizationId, actorUserId, purchase.id, [{ purchaseOrderItemId: must(items[0], "سطر PO").id, quantity: 60, lotNumber: "PO-DEMO-2026-001", cost: 68, expiryDate: new Date(Date.now() + 180 * 86400000) }]);
  }
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.commerce.scenarios.seeded", entityType: "demo_seed", entityId: String(organizationId), metadata: { salesInvoices: 3, purchaseOrders: 1 } });
  return { ...master, salesInvoices: 3, purchaseOrders: 1 };
}

export async function seedDemoOperationsScenarios(actorUserId: number) {
  const commerce = await seedDemoCommerceScenarios(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const organizationId = commerce.organizationId;
  const [rawWarehouse, finishedWarehouse, centralWarehouse] = await Promise.all([
    db.select().from(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.code, "DEMO-RM"))).limit(1).then(rows => rows[0]),
    db.select().from(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.code, "DEMO-FG"))).limit(1).then(rows => rows[0]),
    db.select().from(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.code, "DEMO-CENTRAL"))).limit(1).then(rows => rows[0]),
  ]);
  if (!rawWarehouse || !finishedWarehouse || !centralWarehouse) throw new Error("مخازن التصنيع أو التوزيع لشركة العرض غير مكتملة.");

  const [hqBranch] = await db.select().from(branches).where(and(eq(branches.organizationId, organizationId), eq(branches.code, "DEMO-HQ"))).limit(1);
  const demoProducts = await db.select().from(products).where(eq(products.organizationId, organizationId));
  const demoParties = await db.select().from(businessParties).where(eq(businessParties.organizationId, organizationId));
  const productBySku = new Map(demoProducts.map(product => [product.sku, product]));
  const partyByCode = new Map(demoParties.map(party => [party.code, party]));
  const need = <T>(value: T | undefined, label: string): T => { if (!value) throw new Error(`بيانات Demo ناقصة: ${label}`); return value; };
  const needId = (value: number | null | undefined, label: string) => { if (!value) throw new Error(`بيانات Demo ناقصة: ${label}`); return value; };

  const rawInputs = ["DEMO-025", "DEMO-027", "DEMO-028", "DEMO-029"].map(sku => need(productBySku.get(sku), sku));
  const [existingSupplier] = await db.select().from(businessParties).where(and(eq(businessParties.organizationId, organizationId), eq(businessParties.code, "SUP-002"))).limit(1);
  for (const input of rawInputs) {
    const lotNumber = `DEMO-RM-${input.sku}`;
    const [existing] = await db.select({ id: productBatches.id }).from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, rawWarehouse.id), eq(productBatches.lotNumber, lotNumber))).limit(1);
    if (!existing) await createProductBatch(organizationId, { productId: input.id, warehouseId: rawWarehouse.id, lotNumber, receivedQuantity: 1000, cost: Number(input.purchasePrice), sourcePartyId: existingSupplier?.id, manufacturingDate: new Date(Date.now() - 10 * 86_400_000), expiryDate: new Date(Date.now() + 360 * 86_400_000), status: "active", movementType: "opening_balance", sourceDocumentType: "demo_seed" });
  }

  const milk = need(productBySku.get("DEMO-001"), "DEMO-001");
  const juice = need(productBySku.get("DEMO-005"), "DEMO-005");
  const flour = need(productBySku.get("DEMO-025"), "DEMO-025");
  const bottle = need(productBySku.get("DEMO-027"), "DEMO-027");
  const cap = need(productBySku.get("DEMO-028"), "DEMO-028");
  const label = need(productBySku.get("DEMO-029"), "DEMO-029");
  for (const output of [milk, juice]) await saveManufacturingProductProfile(organizationId, actorUserId, { productId: output.id, manufacturingType: "finished_good", requiresQualityCheck: "yes", defaultShelfLifeDays: output.id === milk.id ? 20 : 45 });

  const [milkBom, juiceBom] = await Promise.all([
    db.select().from(manufacturingBoms).where(and(eq(manufacturingBoms.organizationId, organizationId), eq(manufacturingBoms.code, "BOM-DEMO-MILK"))).limit(1).then(rows => rows[0]),
    db.select().from(manufacturingBoms).where(and(eq(manufacturingBoms.organizationId, organizationId), eq(manufacturingBoms.code, "BOM-DEMO-JUICE"))).limit(1).then(rows => rows[0]),
  ]);
  const milkBomId = milkBom?.id ?? (await createManufacturingBom(organizationId, actorUserId, { code: "BOM-DEMO-MILK", version: "1.0", productId: milk.id, outputQuantity: 100, outputUnit: "وحدة", notes: "BOM Demo للحليب", items: [{ componentProductId: flour.id, quantity: 1, baseQuantity: 1, unit: "وحدة", wasteAllowance: 2, stageCode: "MIX" }, { componentProductId: bottle.id, quantity: 1, baseQuantity: 1, unit: "وحدة", stageCode: "FILL" }, { componentProductId: cap.id, quantity: 1, baseQuantity: 1, unit: "وحدة", stageCode: "PACK" }, { componentProductId: label.id, quantity: 1, baseQuantity: 1, unit: "وحدة", stageCode: "PACK" }] })).id;
  const juiceBomId = juiceBom?.id ?? (await createManufacturingBom(organizationId, actorUserId, { code: "BOM-DEMO-JUICE", version: "1.0", productId: juice.id, outputQuantity: 100, outputUnit: "وحدة", notes: "BOM Demo للعصير", items: [{ componentProductId: flour.id, quantity: 1, baseQuantity: 1, unit: "وحدة", wasteAllowance: 1, stageCode: "MIX" }, { componentProductId: bottle.id, quantity: 1, baseQuantity: 1, unit: "وحدة", stageCode: "FILL" }, { componentProductId: cap.id, quantity: 1, baseQuantity: 1, unit: "وحدة", stageCode: "PACK" }, { componentProductId: label.id, quantity: 1, baseQuantity: 1, unit: "وحدة", stageCode: "PACK" }] })).id;
  await db.update(manufacturingBoms).set({ status: "active" }).where(and(eq(manufacturingBoms.organizationId, organizationId), inArray(manufacturingBoms.id, [milkBomId, juiceBomId])));

  const productionOrdersForDemo = await db.select().from(productionOrders).where(eq(productionOrders.organizationId, organizationId));
  const findOrder = (bomId: number, plannedQuantity: number) => productionOrdersForDemo.find(order => order.bomId === bomId && Number(order.plannedQuantity) === plannedQuantity);
  const ensureProductionOrder = async (bomId: number, plannedQuantity: number) => {
    const found = findOrder(bomId, plannedQuantity);
    if (found) return found;
    const created = await createProductionOrder(organizationId, actorUserId, { bomId, plannedQuantity, plannedUnit: "وحدة", baseQuantity: plannedQuantity, rawMaterialWarehouseId: rawWarehouse.id, finishedGoodsWarehouseId: finishedWarehouse.id, branchId: hqBranch?.id });
    const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.organizationId, organizationId), eq(productionOrders.id, created.id))).limit(1);
    return need(order, `أمر إنتاج ${plannedQuantity}`);
  };
  const advanceToProduction = async (order: { id: number; status: string }) => {
    let status = order.status;
    if (status === "draft") { await transitionProductionOrderStatus(organizationId, actorUserId, order.id, "planned"); status = "planned"; }
    if (status === "planned") { await transitionProductionOrderStatus(organizationId, actorUserId, order.id, "approved"); status = "approved"; }
    if (status === "approved") { await reserveProductionMaterials(organizationId, actorUserId, order.id); status = "materials_reserved"; }
    if (status === "materials_reserved") { await issueMaterialsForProduction(organizationId, actorUserId, order.id); status = "in_production"; }
    return status;
  };

  const completed = await ensureProductionOrder(milkBomId, 100);
  const completedStatus = await advanceToProduction(completed);
  const [completedOutputRow] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, completed.id))).limit(1);
  if (!completedOutputRow && completedStatus === "in_production") {
    const [expense] = await db.select({ id: productionExpenses.id }).from(productionExpenses).where(and(eq(productionExpenses.organizationId, organizationId), eq(productionExpenses.productionOrderId, completed.id))).limit(1);
    if (!expense) await recordProductionExpense(organizationId, actorUserId, { productionOrderId: completed.id, category: "energy", amount: 1250, currencyCode: "DZD", notes: "طاقة تشغيل Demo" });
    await recordProductionOutput(organizationId, actorUserId, completed.id, { lotNumber: "MFG-DEMO-MILK-001", goodQuantity: 96, defectiveQuantity: 2, scrapQuantity: 2, manufacturingDate: new Date(Date.now() - 3 * 86_400_000), expiryDate: new Date(Date.now() + 17 * 86_400_000) });
  }
  const [completedOutput] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, completed.id))).limit(1);
  if (completedOutput && completedOutput.qualityStatus !== "passed") await recordProductionQualityCheck(organizationId, actorUserId, { productionOrderId: completed.id, productionOutputId: completedOutput.id, checkType: "microbiology", result: "pass", numericValue: 98, notes: "نتيجة Demo مطابقة" });
  const [completedWaste] = await db.select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.action, "manufacturing.waste_recorded"), eq(auditLogs.entityId, String(completedOutput?.id ?? 0)))).limit(1);
  if (completedOutput && !completedWaste) await recordProductionWaste(organizationId, actorUserId, { productionOrderId: completed.id, productionOutputId: completedOutput.id, defectiveQuantity: 2, scrapQuantity: 2, reason: "هدر تجريبي للعرض" });

  const qualityHold = await ensureProductionOrder(juiceBomId, 80);
  const qualityHoldStatus = await advanceToProduction(qualityHold);
  const [heldOutputRow] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, qualityHold.id))).limit(1);
  if (!heldOutputRow && qualityHoldStatus === "in_production") await recordProductionOutput(organizationId, actorUserId, qualityHold.id, { lotNumber: "MFG-DEMO-JUICE-HOLD", goodQuantity: 78, defectiveQuantity: 2, manufacturingDate: new Date(Date.now() - 1 * 86_400_000), expiryDate: new Date(Date.now() + 44 * 86_400_000) });
  const [heldOutput] = await db.select().from(productionOutputs).where(and(eq(productionOutputs.organizationId, organizationId), eq(productionOutputs.productionOrderId, qualityHold.id))).limit(1);
  if (heldOutput && heldOutput.qualityStatus !== "quarantined") await recordProductionQualityCheck(organizationId, actorUserId, { productionOrderId: qualityHold.id, productionOutputId: heldOutput.id, checkType: "packaging", result: "fail", notes: "عينة Demo معلقة للمراجعة" });

  const planned = await ensureProductionOrder(milkBomId, 120);
  if (planned.status === "draft") await transitionProductionOrderStatus(organizationId, actorUserId, planned.id, "planned");

  const vehicleSpecs = [
    ["DEMO-TRK-01", "DEMO-101-16", "شاحنة تبريد", 3500, 24], ["DEMO-TRK-02", "DEMO-102-16", "شاحنة توزيع", 3000, 20], ["DEMO-VAN-01", "DEMO-103-16", "فان توزيع", 1600, 12], ["DEMO-VAN-02", "DEMO-104-16", "فان توزيع", 1600, 12],
  ] as const;
  for (const [code, registrationNumber, type, maximumPayloadWeight, maximumVolume] of vehicleSpecs) {
    const [existing] = await db.select({ id: fleetVehicles.id }).from(fleetVehicles).where(and(eq(fleetVehicles.organizationId, organizationId), eq(fleetVehicles.code, code))).limit(1);
    if (!existing) await createFleetVehicle(organizationId, actorUserId, { code, registrationNumber, type, branchId: hqBranch?.id, ownershipType: "owned", maximumPayloadWeight, maximumVolume, palletCapacity: 12, insuranceStartAt: new Date(Date.now() - 300 * 86_400_000), insuranceEndAt: new Date(Date.now() + (code === "DEMO-TRK-01" ? 5 : 180) * 86_400_000), technicalInspectionStartAt: new Date(Date.now() - 300 * 86_400_000), technicalInspectionEndAt: new Date(Date.now() + 120 * 86_400_000) });
  }
  const vehicles = await db.select().from(fleetVehicles).where(eq(fleetVehicles.organizationId, organizationId));
  const truck = need(vehicles.find(vehicle => vehicle.code === "DEMO-TRK-01"), "DEMO-TRK-01");
  const territoryDefinitions = [["DEMO-CENTER", "وسط الجزائر", 36.7538, 3.0588], ["DEMO-EAST", "محور الشرق", 36.365, 6.6147], ["DEMO-SOUTH", "محور الجنوب", 28.0339, 1.6596]] as const;
  for (const [code, name, latitude, longitude] of territoryDefinitions) {
    const result = await db.execute(sql`SELECT id FROM distribution_territories WHERE organizationId = ${organizationId} AND code = ${code} LIMIT 1`);
    const rows = (result as unknown as [Array<{ id: number }>])[0] ?? [];
    if (!rows[0]) await createDistributionTerritory(organizationId, actorUserId, { code, name, latitude, longitude, branchId: hqBranch?.id, defaultVehicleId: truck.id });
  }

  const distributionInvoiceNumber = "INV-DEMO-DIST-001";
  let [distributionInvoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.invoiceNumber, distributionInvoiceNumber))).limit(1);
  if (!distributionInvoice) {
    const created = await createSalesInvoice(organizationId, actorUserId, { invoiceNumber: distributionInvoiceNumber, customerId: need(partyByCode.get("CUS-007"), "CUS-007").id, currencyCode: "DZD", baseCurrencyCode: "DZD", dueDate: new Date(Date.now() + 10 * 86_400_000), lines: [{ productId: milk.id, warehouseId: centralWarehouse.id, quantity: 20 }, { productId: juice.id, warehouseId: centralWarehouse.id, quantity: 18 }] });
    await issueSalesInvoiceWithFefo(organizationId, actorUserId, created.id);
    [distributionInvoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.id, created.id), eq(salesInvoices.organizationId, organizationId))).limit(1);
  }
  const [existingRoute] = await db.select().from(distributionRoutes).where(and(eq(distributionRoutes.organizationId, organizationId), eq(distributionRoutes.routeNumber, "RTE-DEMO-001"))).limit(1);
  if (!existingRoute && distributionInvoice) {
    const territoryResult = await db.execute(sql`SELECT id FROM distribution_territories WHERE organizationId = ${organizationId} AND code = 'DEMO-CENTER' LIMIT 1`);
    const territories = (territoryResult as unknown as [Array<{ id: number }>])[0] ?? [];
    const customer = need(partyByCode.get("CUS-007"), "CUS-007");
    const route = await createDistributionRoute(organizationId, actorUserId, { routeNumber: "RTE-DEMO-001", routeDate: new Date(), branchId: hqBranch?.id, territoryId: territories[0]?.id, vehicleId: truck.id, stops: [{ customerId: customer.id, salesInvoiceId: distributionInvoice.id, notes: "تسليم جزئي Demo" }] });
    await transitionDistributionRoute(organizationId, actorUserId, route.id, "prepared");
    const [milkBatch, juiceBatch] = await Promise.all([
      db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, centralWarehouse.id), eq(productBatches.productId, milk.id), eq(productBatches.status, "active"))).limit(1).then(rows => rows[0]),
      db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.warehouseId, centralWarehouse.id), eq(productBatches.productId, juice.id), eq(productBatches.status, "active"))).limit(1).then(rows => rows[0]),
    ]);
    const load = await createVehicleLoadOrder(organizationId, actorUserId, { loadNumber: "LOAD-DEMO-001", sourceWarehouseId: centralWarehouse.id, vehicleId: truck.id, routeId: route.id, lines: [{ productId: milk.id, batchId: need(milkBatch, "دفعة حليب").id, quantity: 20, unit: "وحدة" }, { productId: juice.id, batchId: need(juiceBatch, "دفعة عصير").id, quantity: 18, unit: "وحدة" }] });
    for (const status of ["prepared", "approved", "loading", "loaded", "dispatched"] as const) await transitionVehicleLoadOrder(organizationId, actorUserId, load.id, status);
    await transitionDistributionRoute(organizationId, actorUserId, route.id, "started");
    const items = await db.select().from(vehicleLoadItems).where(and(eq(vehicleLoadItems.organizationId, organizationId), eq(vehicleLoadItems.loadOrderId, load.id)));
    const milkItem = need(items.find(item => item.productId === milk.id), "تحميل الحليب");
    const juiceItem = need(items.find(item => item.productId === juice.id), "تحميل العصير");
    const stopResult = await db.execute(sql`SELECT id FROM distribution_route_stops WHERE organizationId = ${organizationId} AND routeId = ${route.id} LIMIT 1`);
    const stops = (stopResult as unknown as [Array<{ id: number }>])[0] ?? [];
    const delivery = await recordDistributionDelivery(organizationId, actorUserId, { routeId: route.id, stopId: stops[0]?.id, customerId: customer.id, salesInvoiceId: distributionInvoice.id, idempotencyKey: "demo-delivery-001", notes: "تسليم جزئي Demo", items: [{ productId: milk.id, vehicleBatchId: needId(milkItem.vehicleBatchId, "دفعة مركبة حليب"), expectedQuantity: 20, deliveredQuantity: 12, unit: "وحدة" }, { productId: juice.id, vehicleBatchId: needId(juiceItem.vehicleBatchId, "دفعة مركبة عصير"), expectedQuantity: 18, deliveredQuantity: 0, rejectedQuantity: 18, unit: "وحدة" }] });
    await recordDistributionCollection(organizationId, actorUserId, { routeId: route.id, customerId: customer.id, salesInvoiceId: distributionInvoice.id, collectionType: "current_invoice", amount: 1000, currencyCode: "DZD", paymentMethod: "cash", idempotencyKey: "demo-collection-001" });
    await logFuel(organizationId, actorUserId, { vehicleId: truck.id, routeId: route.id, odometer: 24850, fuelQuantity: 75, fuelType: "diesel", unitPrice: 48, currencyCode: "DZD", vendor: "محطة Demo", occurredAt: new Date() });
    await transitionDistributionRoute(organizationId, actorUserId, route.id, "in_progress");
    await transitionDistributionRoute(organizationId, actorUserId, route.id, "returning");
    await transitionDistributionRoute(organizationId, actorUserId, route.id, "closing");
    await transitionDistributionRoute(organizationId, actorUserId, route.id, "closed");
    await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.operations.distribution_seeded", entityType: "distribution_delivery", entityId: String(delivery.id), metadata: { routeId: route.id, deliveryStatus: delivery.status } });
  }
  await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.operations.seeded", entityType: "demo_seed", entityId: String(organizationId), metadata: { production: true, vehicles: vehicleSpecs.length, route: "RTE-DEMO-001" } });
  return { ...commerce, productionSeeded: true, vehicles: vehicleSpecs.length, distributionRoute: "RTE-DEMO-001" };
}

async function listDemoOrganizationTables() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const result = await db.execute(sql`SELECT DISTINCT table_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND column_name = 'organizationId'`);
  const rows = (result as unknown as [Array<{ name: string }>])[0] ?? [];
  return rows.map(row => row.name).filter(name => /^[a-z0-9_]+$/i.test(name));
}

async function clearDemoOrganizationData(organizationId: number, actorUserId: number, mode: "reset" | "delete") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [organization] = await db.select({ id: organizations.id, isDemo: organizations.isDemo }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization || organization.isDemo !== "yes") throw new Error("هذه العملية متاحة لشركة العرض فقط.");
  const protectedOnReset = new Set(["organizations", "organization_memberships", "organization_roles", "organization_modules", "organization_settings", "demo_seed_runs"]);
  const tables = await listDemoOrganizationTables();
  for (const tableName of tables) {
    if (mode === "reset" && protectedOnReset.has(tableName)) continue;
    await db.execute(sql.raw(`DELETE FROM \`${tableName}\` WHERE \`organizationId\` = ${organizationId}`));
  }
  if (mode === "delete") {
    await db.update(userPreferences).set({ activeOrganizationId: null }).where(eq(userPreferences.activeOrganizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  } else {
    await db.insert(auditLogs).values({ organizationId, actorUserId, action: "demo.reset", entityType: "demo_seed", entityId: String(organizationId), metadata: { datasetVersion: DEMO_ORGANIZATION.datasetVersion } });
    await db.update(demoSeedRuns).set({ status: "ready", resetAt: new Date(), lastActionByUserId: actorUserId }).where(eq(demoSeedRuns.organizationId, organizationId));
  }
}

export async function resetDemoOrganization(actorUserId: number) {
  const demo = await getDemoOrganizationForUser(actorUserId);
  if (!demo) throw new Error("شركة العرض غير متاحة لعضويتك.");
  await clearDemoOrganizationData(demo.organization.id, actorUserId, "reset");
  return seedDemoFoundation(actorUserId);
}

export async function deleteDemoOrganization(actorUserId: number, confirmation: string) {
  if (confirmation !== "DELETE NAWA DEMO") throw new Error("اكتب عبارة التأكيد DELETE NAWA DEMO لحذف بيانات العرض.");
  const demo = await getDemoOrganizationForUser(actorUserId);
  if (!demo) throw new Error("شركة العرض غير متاحة لعضويتك.");
  await clearDemoOrganizationData(demo.organization.id, actorUserId, "delete");
  return { deleted: true, organizationId: demo.organization.id };
}
