import { and, count, eq } from "drizzle-orm";
import { b2bRetailerOrders, employees, organizations, salesInvoices } from "../drizzle/schema.ts";
import { activateDemoOrganizationForUser, deleteDemoOrganization, getDemoOrganizationForUser, resetDemoOrganization, seedDemoRetailHrPayrollScenarios } from "../server/demo.ts";
import { getDb } from "../server/db.ts";

const actorUserId = Number(process.env.DEMO_ACTOR_USER_ID || "1");
if (!Number.isInteger(actorUserId) || actorUserId <= 0) throw new Error("DEMO_ACTOR_USER_ID يجب أن يكون معرف مستخدم موجباً.");

const db = await getDb();
if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
const metric = async (organizationId) => {
  const [sales, retail, staff] = await Promise.all([
    db.select({ total: count() }).from(salesInvoices).where(eq(salesInvoices.organizationId, organizationId)),
    db.select({ total: count() }).from(b2bRetailerOrders).where(eq(b2bRetailerOrders.organizationId, organizationId)),
    db.select({ total: count() }).from(employees).where(eq(employees.organizationId, organizationId)),
  ]);
  return { salesInvoices: Number(sales[0]?.total ?? 0), retailOrders: Number(retail[0]?.total ?? 0), employees: Number(staff[0]?.total ?? 0) };
};
const [nonDemoBefore] = await db.select({ total: count() }).from(organizations).where(eq(organizations.isDemo, "no"));
const before = await getDemoOrganizationForUser(actorUserId);
if (!before) throw new Error("لا توجد مؤسسة Demo مرتبطة بالمستخدم الحالي لاختبار دورة الحياة.");
const beforeMetrics = await metric(before.organization.id);

await resetDemoOrganization(actorUserId);
const afterReset = await getDemoOrganizationForUser(actorUserId);
if (!afterReset || afterReset.organization.id !== before.organization.id) throw new Error("فشل Reset في إبقاء مؤسسة العرض وهيكلها.");
const afterResetMetrics = await metric(afterReset.organization.id);
if (afterResetMetrics.salesInvoices !== 0 || afterResetMetrics.retailOrders !== 0 || afterResetMetrics.employees !== 0) throw new Error("لم يزل Reset بيانات Demo التشغيلية كما هو متوقع.");

await seedDemoRetailHrPayrollScenarios(actorUserId);
const afterReseed = await getDemoOrganizationForUser(actorUserId);
if (!afterReseed) throw new Error("تعذر إعادة Seed شركة العرض بعد Reset.");
const afterReseedMetrics = await metric(afterReseed.organization.id);
if (afterReseedMetrics.salesInvoices < 3 || afterReseedMetrics.retailOrders < 1 || afterReseedMetrics.employees < 4) throw new Error("لم يستعد Seed بيانات العرض التشغيلية بعد Reset.");

const deletedId = afterReseed.organization.id;
await deleteDemoOrganization(actorUserId, "DELETE NAWA DEMO");
const [deletedRow] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, deletedId)).limit(1);
if (deletedRow) throw new Error("فشل Delete في حذف مؤسسة العرض.");
const [nonDemoAfterDelete] = await db.select({ total: count() }).from(organizations).where(eq(organizations.isDemo, "no"));
if (Number(nonDemoAfterDelete?.total ?? 0) !== Number(nonDemoBefore?.total ?? 0)) throw new Error("تأثرت مؤسسة غير تجريبية أثناء حذف شركة العرض.");

const recreated = await seedDemoRetailHrPayrollScenarios(actorUserId);
await activateDemoOrganizationForUser(actorUserId);
const afterRecreate = await getDemoOrganizationForUser(actorUserId);
if (!afterRecreate || afterRecreate.organization.id === deletedId) throw new Error("لم تُنشأ مؤسسة عرض جديدة بعد الحذف.");
const finalMetrics = await metric(afterRecreate.organization.id);
if (finalMetrics.salesInvoices < 3 || finalMetrics.retailOrders < 1 || finalMetrics.employees < 4) throw new Error("مؤسسة العرض المعاد إنشاؤها غير مكتملة.");

console.log(JSON.stringify({ before: { organizationId: before.organization.id, metrics: beforeMetrics }, afterReset: { organizationId: afterReset.organization.id, metrics: afterResetMetrics }, recreated: { organizationId: recreated.organizationId, metrics: finalMetrics }, nonDemoOrganizations: Number(nonDemoAfterDelete?.total ?? 0), result: "pass" }, null, 2));
