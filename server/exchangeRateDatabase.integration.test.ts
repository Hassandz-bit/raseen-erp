import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { organizationExchangeRates, organizations } from "../drizzle/schema";
import { addOrganizationExchangeRate, getDb, listOrganizationExchangeRates } from "./db";

let organizationIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const organizationId of organizationIds) {
    await db.delete(organizationExchangeRates).where(eq(organizationExchangeRates.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  organizationIds = [];
});

describe("عزل سجل أسعار الصرف", () => {
  it("يعرض المرشح نتائج المؤسسة الحالية فقط ويحافظ على المجال التاريخي", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = await db.insert(organizations).values({ name: `سعر أول ${suffix}`, slug: `rate-one-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const second = await db.insert(organizations).values({ name: `سعر ثانٍ ${suffix}`, slug: `rate-two-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const firstOrganizationId = Number(first[0].insertId);
    const secondOrganizationId = Number(second[0].insertId);
    organizationIds = [firstOrganizationId, secondOrganizationId];
    await addOrganizationExchangeRate(firstOrganizationId, 1, { baseCurrencyCode: "DZD", quoteCurrencyCode: "EUR", rate: 0.0062, effectiveAt: new Date("2026-03-15T00:00:00Z") });
    await addOrganizationExchangeRate(secondOrganizationId, 1, { baseCurrencyCode: "DZD", quoteCurrencyCode: "EUR", rate: 0.0065, effectiveAt: new Date("2026-03-15T00:00:00Z") });
    await expect(addOrganizationExchangeRate(firstOrganizationId, 1, { baseCurrencyCode: "EUR", quoteCurrencyCode: "DZD", rate: 160, effectiveAt: new Date("2026-03-16T00:00:00Z") })).rejects.toThrow("يجب أن تطابق عملة الأساس العملة الأساسية للمؤسسة");

    const firstRows = await listOrganizationExchangeRates(firstOrganizationId, { currencyCode: "EUR", startDate: new Date("2026-03-01T00:00:00Z"), endDate: new Date("2026-03-31T23:59:59Z") });
    const secondRows = await listOrganizationExchangeRates(secondOrganizationId, { currencyCode: "EUR" });
    const outsideRange = await listOrganizationExchangeRates(firstOrganizationId, { startDate: new Date("2026-04-01T00:00:00Z") });
    expect(firstRows).toHaveLength(1);
    expect(firstRows[0].organizationId).toBe(firstOrganizationId);
    expect(secondRows).toHaveLength(1);
    expect(secondRows[0].organizationId).toBe(secondOrganizationId);
    expect(outsideRange).toHaveLength(0);
  });
});
