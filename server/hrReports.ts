import { and, eq } from "drizzle-orm";
import { attendanceRecords, employees } from "../drizzle/schema";
import { commissionEntries, employeeAdvances, employeeProfiles, leaveRequests, overtimeEntries, payrollPeriods, payrollRunEmployees } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";

export async function getHrOperationalReports(organizationId: number, filters?: { branchId?: number; departmentId?: number }) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [employeeList, attendance, leaves, overtime, advances, commissions, payrollRegister] = await Promise.all([
    db.select({ id: employees.id, employeeNumber: employees.employeeNumber, fullName: employees.fullName, branchId: employeeProfiles.branchId, departmentId: employeeProfiles.departmentId, positionId: employeeProfiles.positionId, status: employees.status }).from(employees).leftJoin(employeeProfiles, and(eq(employeeProfiles.organizationId, organizationId), eq(employeeProfiles.employeeId, employees.id))).where(eq(employees.organizationId, organizationId)),
    db.select().from(attendanceRecords).where(eq(attendanceRecords.organizationId, organizationId)),
    db.select().from(leaveRequests).where(eq(leaveRequests.organizationId, organizationId)),
    db.select().from(overtimeEntries).where(eq(overtimeEntries.organizationId, organizationId)),
    db.select().from(employeeAdvances).where(eq(employeeAdvances.organizationId, organizationId)),
    db.select().from(commissionEntries).where(eq(commissionEntries.organizationId, organizationId)),
    db.select({ payrollPeriodId: payrollRunEmployees.payrollPeriodId, employeeId: payrollRunEmployees.employeeId, employeeNumber: employees.employeeNumber, currencyCode: payrollRunEmployees.currencyCode, grossPay: payrollRunEmployees.grossPay, netPay: payrollRunEmployees.netPay, status: payrollRunEmployees.status, periodName: payrollPeriods.name, branchId: employeeProfiles.branchId, departmentId: employeeProfiles.departmentId }).from(payrollRunEmployees).innerJoin(payrollPeriods, and(eq(payrollPeriods.id, payrollRunEmployees.payrollPeriodId), eq(payrollPeriods.organizationId, organizationId))).innerJoin(employees, and(eq(employees.id, payrollRunEmployees.employeeId), eq(employees.organizationId, organizationId))).leftJoin(employeeProfiles, and(eq(employeeProfiles.employeeId, payrollRunEmployees.employeeId), eq(employeeProfiles.organizationId, organizationId))).where(eq(payrollRunEmployees.organizationId, organizationId)),
  ]);
  const scopedEmployees = employeeList.filter(employee => (filters?.branchId === undefined || employee.branchId === filters.branchId) && (filters?.departmentId === undefined || employee.departmentId === filters.departmentId));
  const scopedEmployeeIds = new Set(scopedEmployees.map(employee => employee.id).filter((id): id is number => typeof id === "number"));
  const withinScope = (employeeId: number) => scopedEmployeeIds.has(employeeId);
  return { employeeList: scopedEmployees, attendance: attendance.filter(row => withinScope(row.employeeId)), leaves: leaves.filter(row => withinScope(row.employeeId)), overtime: overtime.filter(row => withinScope(row.employeeId)), advances: advances.filter(row => withinScope(row.employeeId)), commissions: commissions.filter(row => withinScope(row.employeeId)), payrollRegister: payrollRegister.filter(row => withinScope(row.employeeId)) };
}
