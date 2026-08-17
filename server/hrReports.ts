import { and, eq } from "drizzle-orm";
import { attendanceRecords, employees } from "../drizzle/schema";
import { commissionEntries, employeeAdvances, employeeProfiles, leaveRequests, overtimeEntries, payrollPeriods, payrollRunEmployees } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";

export async function getHrOperationalReports(organizationId: number) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [employeeList, attendance, leaves, overtime, advances, commissions, payrollRegister] = await Promise.all([
    db.select({ employeeNumber: employees.employeeNumber, fullName: employees.fullName, branchId: employeeProfiles.branchId, departmentId: employeeProfiles.departmentId, positionId: employeeProfiles.positionId, status: employees.status }).from(employees).leftJoin(employeeProfiles, and(eq(employeeProfiles.organizationId, organizationId), eq(employeeProfiles.employeeId, employees.id))).where(eq(employees.organizationId, organizationId)),
    db.select().from(attendanceRecords).where(eq(attendanceRecords.organizationId, organizationId)),
    db.select().from(leaveRequests).where(eq(leaveRequests.organizationId, organizationId)),
    db.select().from(overtimeEntries).where(eq(overtimeEntries.organizationId, organizationId)),
    db.select().from(employeeAdvances).where(eq(employeeAdvances.organizationId, organizationId)),
    db.select().from(commissionEntries).where(eq(commissionEntries.organizationId, organizationId)),
    db.select({ payrollPeriodId: payrollRunEmployees.payrollPeriodId, employeeId: payrollRunEmployees.employeeId, employeeNumber: employees.employeeNumber, currencyCode: payrollRunEmployees.currencyCode, grossPay: payrollRunEmployees.grossPay, netPay: payrollRunEmployees.netPay, status: payrollRunEmployees.status, periodName: payrollPeriods.name, branchId: employeeProfiles.branchId, departmentId: employeeProfiles.departmentId }).from(payrollRunEmployees).innerJoin(payrollPeriods, and(eq(payrollPeriods.id, payrollRunEmployees.payrollPeriodId), eq(payrollPeriods.organizationId, organizationId))).innerJoin(employees, and(eq(employees.id, payrollRunEmployees.employeeId), eq(employees.organizationId, organizationId))).leftJoin(employeeProfiles, and(eq(employeeProfiles.employeeId, payrollRunEmployees.employeeId), eq(employeeProfiles.organizationId, organizationId))).where(eq(payrollRunEmployees.organizationId, organizationId)),
  ]);
  return { employeeList, attendance, leaves, overtime, advances, commissions, payrollRegister };
}
