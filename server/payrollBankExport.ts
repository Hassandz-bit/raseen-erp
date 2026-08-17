import { and, eq } from "drizzle-orm";
import { employees } from "../drizzle/schema";
import { employeeProfiles, payrollPeriods, payrollRunEmployees } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";

const escapeCsv = (value: string, delimiter: string) => `"${value.replaceAll("\"", "\"\"")}"`;

export async function exportPaidPayrollBankFile(organizationId: number, payrollPeriodId: number, delimiter: "," | ";" = ",") {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [period] = await db.select().from(payrollPeriods).where(and(eq(payrollPeriods.organizationId, organizationId), eq(payrollPeriods.id, payrollPeriodId))).limit(1);
  if (!period || period.status !== "paid") throw new Error("لا يمكن تصدير كشف بنك إلا لفترة رواتب مدفوعة ضمن المؤسسة.");
  const rows = await db.select({ employeeNumber: employees.employeeNumber, employeeName: employees.fullName, bankAccountReference: employeeProfiles.bankAccountReference, netPay: payrollRunEmployees.netPay, currencyCode: payrollRunEmployees.currencyCode }).from(payrollRunEmployees).innerJoin(employees, and(eq(employees.id, payrollRunEmployees.employeeId), eq(employees.organizationId, organizationId))).leftJoin(employeeProfiles, and(eq(employeeProfiles.employeeId, payrollRunEmployees.employeeId), eq(employeeProfiles.organizationId, organizationId))).where(and(eq(payrollRunEmployees.organizationId, organizationId), eq(payrollRunEmployees.payrollPeriodId, payrollPeriodId), eq(payrollRunEmployees.status, "paid")));
  const valid = rows.filter(row => row.bankAccountReference?.trim() && Number(row.netPay) > 0); const excluded = rows.filter(row => !row.bankAccountReference?.trim() || Number(row.netPay) <= 0).map(row => ({ employeeNumber: row.employeeNumber, reason: !row.bankAccountReference?.trim() ? "missing_bank_reference" : "non_positive_net_pay" }));
  const header = ["beneficiary_name", "bank_account_reference", "amount", "currency", "reference"];
  const lines = valid.map(row => [row.employeeName, row.bankAccountReference!.trim(), Number(row.netPay).toFixed(2), row.currencyCode, `PAYROLL-${payrollPeriodId}-${row.employeeNumber}`].map(value => escapeCsv(value, delimiter)).join(delimiter));
  return { filename: `nawa-payroll-bank-${payrollPeriodId}.csv`, content: [header.join(delimiter), ...lines].join("\r\n"), exportedCount: valid.length, excluded };
}
