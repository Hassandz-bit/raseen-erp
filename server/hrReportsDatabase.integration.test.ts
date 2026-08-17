import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auditLogs, employees, organizations } from "../drizzle/schema";
import { employeeProfiles, payrollPeriods, payrollRunEmployees } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";
import { getHrOperationalReports } from "./hrReports";

let organizationId: number | null = null;
afterEach(async () => {
  if (!organizationId) return;
  const db = await getDb(); if (!db) return;
  const id = organizationId;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, id));
  await db.delete(payrollRunEmployees).where(eq(payrollRunEmployees.organizationId, id));
  await db.delete(payrollPeriods).where(eq(payrollPeriods.organizationId, id));
  await db.delete(employeeProfiles).where(eq(employeeProfiles.organizationId, id));
  await db.delete(employees).where(eq(employees.organizationId, id));
  await db.delete(organizations).where(eq(organizations.id, id));
  organizationId = null;
});

describe("تقارير HR المقيّدة بالنطاق", () => {
  it("تحصر الدليل وسجل الرواتب في الفرع أو القسم المطلوبين داخل المؤسسة", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const organization = await db.insert(organizations).values({ name: `تقارير HR ${suffix}`, slug: `hr-reports-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(organization[0].insertId);
    const first = await db.insert(employees).values({ organizationId, fullName: "موظف فرع أ", employeeNumber: `A-${suffix}`, status: "active" });
    const second = await db.insert(employees).values({ organizationId, fullName: "موظف فرع ب", employeeNumber: `B-${suffix}`, status: "active" });
    const firstId = Number(first[0].insertId); const secondId = Number(second[0].insertId);
    await db.insert(employeeProfiles).values([{ organizationId, employeeId: firstId, branchId: 101, departmentId: 501, payrollCurrency: "SAR", status: "active" }, { organizationId, employeeId: secondId, branchId: 202, departmentId: 502, payrollCurrency: "SAR", status: "active" }]);
    const period = await db.insert(payrollPeriods).values({ organizationId, name: `P-${suffix}`, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-31T23:59:59Z"), status: "paid" });
    const periodId = Number(period[0].insertId);
    await db.insert(payrollRunEmployees).values([{ organizationId, payrollPeriodId: periodId, employeeId: firstId, currencyCode: "SAR", baseSalary: "100", grossPay: "100", netPay: "100", snapshot: {}, status: "paid" }, { organizationId, payrollPeriodId: periodId, employeeId: secondId, currencyCode: "SAR", baseSalary: "200", grossPay: "200", netPay: "200", snapshot: {}, status: "paid" }]);
    const report = await getHrOperationalReports(organizationId, { branchId: 101 });
    expect(report.employeeList).toHaveLength(1);
    expect(report.employeeList[0].employeeNumber).toBe(`A-${suffix}`);
    expect(report.payrollRegister).toHaveLength(1);
    expect(report.payrollRegister[0].employeeId).toBe(firstId);
  });
});
