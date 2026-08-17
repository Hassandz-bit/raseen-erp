import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLogs, employees, organizations } from "../drizzle/schema";
import { employeeProfiles, payrollPeriods, payrollRunEmployees } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";
import { exportPaidPayrollBankFile } from "./payrollBankExport";

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

describe("تصدير كشف الرواتب البنكي", () => {
  it("يصدر الصفوف البنكية الصالحة فقط بصيغة CSV وبيانات Excel من فترة مدفوعة", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const org = await db.insert(organizations).values({ name: `بنك رواتب ${suffix}`, slug: `payroll-bank-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(org[0].insertId);
    const validEmployee = await db.insert(employees).values({ organizationId, fullName: "موظف تحويل", employeeNumber: `PAY-${suffix}`, status: "active" });
    const excludedEmployee = await db.insert(employees).values({ organizationId, fullName: "موظف ناقص", employeeNumber: `MISS-${suffix}`, status: "active" });
    const validId = Number(validEmployee[0].insertId); const excludedId = Number(excludedEmployee[0].insertId);
    await db.insert(employeeProfiles).values([{ organizationId, employeeId: validId, payrollCurrency: "SAR", bankAccountReference: "SA001234567890", status: "active" }, { organizationId, employeeId: excludedId, payrollCurrency: "SAR", status: "active" }]);
    const period = await db.insert(payrollPeriods).values({ organizationId, name: `P-${suffix}`, startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: new Date("2026-08-31T23:59:59Z"), status: "paid" });
    const periodId = Number(period[0].insertId);
    await db.insert(payrollRunEmployees).values([{ organizationId, payrollPeriodId: periodId, employeeId: validId, currencyCode: "SAR", baseSalary: "2000", grossPay: "2000", netPay: "1800", snapshot: {}, status: "paid" }, { organizationId, payrollPeriodId: periodId, employeeId: excludedId, currencyCode: "SAR", baseSalary: "1000", grossPay: "1000", netPay: "900", snapshot: {}, status: "paid" }]);
    const result = await exportPaidPayrollBankFile(organizationId, periodId, ";");
    expect(result.exportedCount).toBe(1);
    expect(result.rows).toEqual([{ beneficiaryName: "موظف تحويل", bankAccountReference: "SA001234567890", amount: "1800.00", currencyCode: "SAR", reference: `PAYROLL-${periodId}-PAY-${suffix}` }]);
    expect(result.excluded).toEqual([{ employeeNumber: `MISS-${suffix}`, reason: "missing_bank_reference" }]);
    expect(result.content).toContain("beneficiary_name;bank_account_reference;amount;currency;reference");
    expect(result.content).toContain("SA001234567890");
  });
});
