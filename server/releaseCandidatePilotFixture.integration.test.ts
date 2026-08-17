import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  b2bPromotions,
  b2bRetailerAccesses,
  b2bRetailerOutlets,
  businessParties,
  inventoryBalances,
  organizationModules,
  organizations,
  priceListItems,
  priceLists,
  productBatches,
  products,
  users,
  warehouses,
} from "../drizzle/schema";
import { getDb } from "./db";

type Fixture = { organizationId: number; userIds: number[] };
let fixture: Fixture | null = null;

afterEach(async () => {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;
  const { organizationId, userIds } = fixture;
  await db.delete(b2bPromotions).where(eq(b2bPromotions.organizationId, organizationId));
  await db.delete(b2bRetailerOutlets).where(eq(b2bRetailerOutlets.organizationId, organizationId));
  await db.delete(b2bRetailerAccesses).where(eq(b2bRetailerAccesses.organizationId, organizationId));
  await db.delete(inventoryBalances).where(eq(inventoryBalances.organizationId, organizationId));
  await db.delete(productBatches).where(eq(productBatches.organizationId, organizationId));
  await db.delete(priceListItems).where(eq(priceListItems.organizationId, organizationId));
  await db.delete(priceLists).where(eq(priceLists.organizationId, organizationId));
  await db.delete(warehouses).where(eq(warehouses.organizationId, organizationId));
  await db.delete(products).where(eq(products.organizationId, organizationId));
  await db.delete(businessParties).where(eq(businessParties.organizationId, organizationId));
  await db.delete(organizationModules).where(eq(organizationModules.organizationId, organizationId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  fixture = null;
});

describe("Fixture الطيار المعزول لـ Nawa Retail", () => {
  it("ينشئ موردًا وتاجرين وثلاثة منافذ وكتالوجًا متنوعًا ودفعات اختبارية دون بقاء بيانات", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const [supplier] = await db.insert(organizations).values({ name: `RC Pilot Supplier ${suffix}`, slug: `rc-pilot-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const organizationId = Number(supplier.insertId);
    const createdUsers = await db.insert(users).values([
      { openId: `rc-supplier-${suffix}`, name: "Pilot Supplier Admin", email: `supplier-${suffix}@pilot.invalid` },
      { openId: `rc-retailer-a-owner-${suffix}`, name: "Pilot Retailer A Owner", email: `a-owner-${suffix}@pilot.invalid` },
      { openId: `rc-retailer-a-buyer-${suffix}`, name: "Pilot Retailer A Buyer", email: `a-buyer-${suffix}@pilot.invalid` },
      { openId: `rc-retailer-b-${suffix}`, name: "Pilot Retailer B Owner", email: `b-owner-${suffix}@pilot.invalid` },
    ]);
    const firstUserId = Number(createdUsers[0].insertId);
    const userIds = [firstUserId, firstUserId + 1, firstUserId + 2, firstUserId + 3];
    fixture = { organizationId, userIds };

    await db.insert(organizationModules).values({ organizationId, moduleKey: "nawa_retail", status: "active", changeSource: "rc_pilot_fixture" });
    const [warehouse] = await db.insert(warehouses).values({ organizationId, code: `RC-WH-${suffix}`, name: "RC Pilot Warehouse", status: "active" });
    const warehouseId = Number(warehouse.insertId);
    const createdParties = await db.insert(businessParties).values([
      { organizationId, code: `RC-A-${suffix}`, name: "RC Retailer A", types: ["customer"], customerSegment: "gold", creditLimit: "10000", status: "active" },
      { organizationId, code: `RC-B-${suffix}`, name: "RC Retailer B", types: ["customer"], customerSegment: "silver", creditLimit: "2500", status: "active" },
    ]);
    const retailerAId = Number(createdParties[0].insertId);
    const retailerBId = retailerAId + 1;
    const productRows = Array.from({ length: 15 }, (_, index) => ({
      organizationId,
      sku: `RC-SKU-${suffix}-${index + 1}`,
      name: `RC Pilot Product ${index + 1}`,
      nameAr: `منتج طيار ${index + 1}`,
      productType: index === 13 ? "expiring" as const : "standard" as const,
      baseUnit: "PCS",
      unit: "PCS",
      purchaseUnit: "CARTON",
      salesUnit: index % 3 === 0 ? "CARTON" : "PCS",
      unitsPerCarton: index % 3 === 0 ? "12" : "1",
      grossWeight: "1.250",
      volume: "0.015000",
      salePrice: String(100 + index * 10),
      status: "active" as const,
    }));
    const createdProducts = await db.insert(products).values(productRows);
    const firstProductId = Number(createdProducts[0].insertId);
    const productIds = Array.from({ length: 15 }, (_, index) => firstProductId + index);
    const [retailPriceList] = await db.insert(priceLists).values({ organizationId, name: "RC Pilot Retail Price List", kind: "customer", priority: 10, currencyCode: "DZD", status: "active" });
    const priceListId = Number(retailPriceList.insertId);
    await db.insert(priceListItems).values(productIds.map((productId, index) => ({ organizationId, priceListId, productId, unit: index % 3 === 0 ? "CARTON" : "PCS", price: String(95 + index * 10), minimumQuantity: "1" })));
    await db.insert(productBatches).values([
      { organizationId, productId: productIds[0], warehouseId, lotNumber: `RC-SAFE-${suffix}`, receivedQuantity: "150", currentQuantity: "150", cost: "50", status: "active" },
      { organizationId, productId: productIds[13], warehouseId, lotNumber: `RC-NEAR-${suffix}`, receivedQuantity: "40", currentQuantity: "40", cost: "55", expiryDate: new Date(Date.now() + 7 * 86_400_000), status: "active" },
      { organizationId, productId: productIds[14], warehouseId, lotNumber: `RC-EXPIRED-${suffix}`, receivedQuantity: "20", currentQuantity: "20", cost: "60", expiryDate: new Date(Date.now() - 86_400_000), status: "blocked" },
    ]);
    await db.insert(inventoryBalances).values(productIds.map((productId, index) => ({ organizationId, productId, warehouseId, quantity: index === 14 ? "0" : index === 13 ? "40" : "150", reservedQuantity: "0" })));
    const outletRows = await db.insert(b2bRetailerOutlets).values([
      { organizationId, customerId: retailerAId, code: `A1-${suffix}`, name: "Retailer A Outlet 1", address: "Pilot A1", status: "active" },
      { organizationId, customerId: retailerAId, code: `A2-${suffix}`, name: "Retailer A Outlet 2", address: "Pilot A2", status: "active" },
      { organizationId, customerId: retailerBId, code: `B1-${suffix}`, name: "Retailer B Outlet 1", address: "Pilot B1", status: "active" },
    ]);
    const outletA1 = Number(outletRows[0].insertId);
    const outletA2 = outletA1 + 1;
    await db.insert(b2bRetailerAccesses).values([
      { organizationId, customerId: retailerAId, userId: userIds[1], status: "active", retailerRole: "owner", outletIds: [outletA1, outletA2], priceListId, customerSegment: "gold", availabilityDisclosure: "low", deliveryTrackingPolicy: "status_only", visibilityPolicy: { debtVisibility: "invoice_breakdown", stockVisibility: "level", deliveryTracking: "status_only", allowReturnRequest: true }, grantedAt: new Date() },
      { organizationId, customerId: retailerAId, userId: userIds[2], status: "active", retailerRole: "buyer", outletIds: [outletA1], priceListId, customerSegment: "gold", availabilityDisclosure: "low", deliveryTrackingPolicy: "status_only", visibilityPolicy: { debtVisibility: "hidden", stockVisibility: "level", deliveryTracking: "status_only", allowReturnRequest: true }, grantedAt: new Date() },
      { organizationId, customerId: retailerBId, userId: userIds[3], status: "active", retailerRole: "owner", priceListId, customerSegment: "silver", availabilityDisclosure: "available", deliveryTrackingPolicy: "off", visibilityPolicy: { debtVisibility: "total_only", stockVisibility: "availability_only", deliveryTracking: "off" }, grantedAt: new Date() },
    ]);
    await db.insert(b2bPromotions).values([
      { organizationId, name: "RC Quantity Discount", status: "active", type: "quantity_discount", productId: productIds[1], customerId: retailerAId, minimumQuantity: "10", discountPercentage: "5", startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 14 * 86_400_000), createdByUserId: userIds[0] },
      { organizationId, name: "RC Buy X Get Y", status: "active", type: "buy_x_get_y", productId: productIds[2], customerId: retailerAId, buyQuantity: "5", getQuantity: "1", startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 14 * 86_400_000), createdByUserId: userIds[0] },
    ]);

    const savedProducts = await db.select().from(products).where(eq(products.organizationId, organizationId));
    const savedOutlets = await db.select().from(b2bRetailerOutlets).where(eq(b2bRetailerOutlets.organizationId, organizationId));
    const savedAccesses = await db.select().from(b2bRetailerAccesses).where(eq(b2bRetailerAccesses.organizationId, organizationId));
    const expiredBatch = await db.select().from(productBatches).where(and(eq(productBatches.organizationId, organizationId), eq(productBatches.lotNumber, `RC-EXPIRED-${suffix}`))).limit(1);
    expect(savedProducts).toHaveLength(15);
    expect(savedOutlets).toHaveLength(3);
    expect(savedAccesses).toHaveLength(3);
    expect(savedAccesses.find(row => row.userId === userIds[2])?.outletIds).toEqual([outletA1]);
    expect(expiredBatch[0]?.status).toBe("blocked");
  });
});
