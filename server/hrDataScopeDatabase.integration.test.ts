import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { employees, organizations } from "../drizzle/schema";
import { employeeProfiles } from "../drizzle/hrPayrollSchema";
import { assertHrEmployeeInScope, resolveHrEmployeeScope } from "./hrDataScope";
import { getDb } from "./db";

let organizationId: number | null = null;
afterEach(async () => {
  if (!organizationId) return;
  const db = await getDb(); if (!db) return;
  const id = organizationId;
  await db.delete(employeeProfiles).where(eq(employeeProfiles.organizationId, id));
  await db.delete(employees).where(eq(employees.organizationId, id));
  await db.delete(organizations).where(eq(organizations.id, id));
  organizationId = null;
});

describe("نطاق بيانات الموارد البشرية", () => {
  it("يرفض الموظف خارج الفرع أو القسم ويسمح للتقرير المباشر فقط عند تصريح المدير", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const org = await db.insert(organizations).values({ name: `نطاق HR ${suffix}`, slug: `hr-scope-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(org[0].insertId);
    const manager = await db.insert(employees).values({ organizationId, fullName: "مدير فرع", employeeNumber: `M-${suffix}`, status: "active" });
    const teamMember = await db.insert(employees).values({ organizationId, fullName: "تقرير مباشر", employeeNumber: `T-${suffix}`, status: "active" });
    const other = await db.insert(employees).values({ organizationId, fullName: "خارج النطاق", employeeNumber: `O-${suffix}`, status: "active" });
    const managerId = Number(manager[0].insertId); const teamMemberId = Number(teamMember[0].insertId); const otherId = Number(other[0].insertId);
    await db.insert(employeeProfiles).values([{ organizationId, employeeId: managerId, userId: 710_001, branchId: 10, departmentId: 100, payrollCurrency: "SAR", status: "active" }, { organizationId, employeeId: teamMemberId, branchId: 10, departmentId: 100, managerEmployeeId: managerId, payrollCurrency: "SAR", status: "active" }, { organizationId, employeeId: otherId, branchId: 20, departmentId: 200, payrollCurrency: "SAR", status: "active" }]);
    const scope = await resolveHrEmployeeScope({ organizationId, userId: 710_001, roleKey: "line_manager", dataScope: { branchIds: [10], departmentIds: [100] } });
    await expect(assertHrEmployeeInScope(scope, teamMemberId, { allowDirectReports: true })).resolves.toMatchObject({ employeeId: teamMemberId });
    await expect(assertHrEmployeeInScope(scope, otherId, { allowDirectReports: true })).rejects.toThrow("خارج نطاق بيانات الموارد البشرية");
    await expect(assertHrEmployeeInScope(scope, teamMemberId)).resolves.toMatchObject({ employeeId: teamMemberId });
  });
});
