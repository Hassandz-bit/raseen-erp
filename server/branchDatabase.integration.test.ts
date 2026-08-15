import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { branches, organizations } from "../drizzle/schema";
import { createBranchForOrganization, getDb, listBranchesForOrganization } from "./db";

let organizationIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const organizationId of organizationIds) {
    await db.delete(branches).where(eq(branches.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  organizationIds = [];
});

describe("فروع المؤسسة المعزولة", () => {
  it("يعزل قائمة الفروع ويسمح بالرمز نفسه بين مؤسستين ويرفضه داخل المؤسسة نفسها", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const first = await db.insert(organizations).values({ name: `فرع أول ${suffix}`, slug: `branch-one-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const second = await db.insert(organizations).values({ name: `فرع ثان ${suffix}`, slug: `branch-two-${suffix}`, status: "active", baseCurrency: "DZD", locale: "ar-DZ", monthlyBudget: "0" });
    const firstId = Number(first[0].insertId);
    const secondId = Number(second[0].insertId);
    organizationIds = [firstId, secondId];

    await createBranchForOrganization(firstId, { code: "HQ", name: "المقر" });
    await createBranchForOrganization(secondId, { code: "HQ", name: "مقر مستقل" });
    await expect(createBranchForOrganization(firstId, { code: "HQ", name: "مقر مكرر" })).rejects.toThrow();

    const firstBranches = await listBranchesForOrganization(firstId);
    const secondBranches = await listBranchesForOrganization(secondId);
    expect(firstBranches).toHaveLength(1);
    expect(secondBranches).toHaveLength(1);
    expect(firstBranches[0]?.name).toBe("المقر");
    expect(secondBranches[0]?.name).toBe("مقر مستقل");
    const crossTenantRows = await db.select().from(branches).where(and(eq(branches.organizationId, firstId), eq(branches.name, "مقر مستقل")));
    expect(crossTenantRows).toHaveLength(0);
  });
});
