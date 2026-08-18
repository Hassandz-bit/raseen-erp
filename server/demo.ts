import { and, eq, sql } from "drizzle-orm";
import { auditLogs, branches, demoSeedRuns, organizationMemberships, organizationModules, organizationRoles, organizationSettings, organizations, userPreferences, warehouses } from "../drizzle/schema";
import { defaultDocumentSettings, getDb, setActiveOrganizationForUser } from "./db";

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

    await tx.insert(organizationMemberships).values({ organizationId: id, userId: actorUserId, roleKey: "owner", status: "active" }).onDuplicateKeyUpdate({ set: { roleKey: "owner", status: "active" } });
    await tx.insert(organizationRoles).values({ organizationId: id, key: "owner", name: "مالك شركة العرض", description: "دور كامل الصلاحية لشركة العرض المعزولة.", permissions: ["*"] }).onDuplicateKeyUpdate({ set: { name: "مالك شركة العرض", description: "دور كامل الصلاحية لشركة العرض المعزولة.", permissions: ["*"] } });
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
