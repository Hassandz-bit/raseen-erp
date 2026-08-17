import { and, eq } from "drizzle-orm";
import { employees } from "../drizzle/schema";
import { employeeProfiles } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";

export type HrScopeInput = {
  organizationId: number;
  userId: number;
  roleKey: string;
  dataScope?: { branchIds?: number[]; departmentIds?: number[]; employeeIds?: number[] } | null;
};

export type HrEmployeeScope = HrScopeInput & {
  ownEmployeeId?: number;
  branchIds: number[];
  departmentIds: number[];
  employeeIds: number[];
};

export async function resolveHrEmployeeScope(input: HrScopeInput): Promise<HrEmployeeScope> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [profile] = await db.select({ employeeId: employeeProfiles.employeeId }).from(employeeProfiles).where(and(eq(employeeProfiles.organizationId, input.organizationId), eq(employeeProfiles.userId, input.userId), eq(employeeProfiles.status, "active"))).limit(1);
  return { ...input, ownEmployeeId: profile?.employeeId, branchIds: input.dataScope?.branchIds ?? [], departmentIds: input.dataScope?.departmentIds ?? [], employeeIds: input.dataScope?.employeeIds ?? [] };
}

export async function assertHrEmployeeInScope(scope: HrEmployeeScope, employeeId: number, options: { allowSelf?: boolean; allowDirectReports?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [target] = await db.select({ employeeId: employees.id, branchId: employeeProfiles.branchId, departmentId: employeeProfiles.departmentId, managerEmployeeId: employeeProfiles.managerEmployeeId }).from(employees).leftJoin(employeeProfiles, and(eq(employeeProfiles.organizationId, employees.organizationId), eq(employeeProfiles.employeeId, employees.id))).where(and(eq(employees.organizationId, scope.organizationId), eq(employees.id, employeeId))).limit(1);
  if (!target) throw new Error("الموظف غير متاح ضمن المؤسسة الحالية.");
  if (scope.roleKey === "owner") return target;
  if (options.allowSelf && scope.ownEmployeeId === employeeId) return target;
  if (options.allowDirectReports && scope.ownEmployeeId && target.managerEmployeeId === scope.ownEmployeeId) return target;
  const branchAllowed = scope.branchIds.length === 0 || (target.branchId !== null && scope.branchIds.includes(target.branchId));
  const departmentAllowed = scope.departmentIds.length === 0 || (target.departmentId !== null && scope.departmentIds.includes(target.departmentId));
  const employeeAllowed = scope.employeeIds.length === 0 || scope.employeeIds.includes(employeeId);
  if (!branchAllowed || !departmentAllowed || !employeeAllowed) throw new Error("الموظف خارج نطاق بيانات الموارد البشرية المصرح به.");
  return target;
}

export function hasRestrictedHrScope(scope: HrEmployeeScope) {
  return scope.roleKey !== "owner" && (scope.branchIds.length > 0 || scope.departmentIds.length > 0 || scope.employeeIds.length > 0);
}

export function isHrRowInScope(scope: HrEmployeeScope, row: { employeeId?: number; id?: number; branchId?: number | null; departmentId?: number | null }) {
  if (scope.roleKey === "owner") return true;
  const employeeId = row.employeeId ?? row.id;
  const branchAllowed = scope.branchIds.length === 0 || (row.branchId !== null && row.branchId !== undefined && scope.branchIds.includes(row.branchId));
  const departmentAllowed = scope.departmentIds.length === 0 || (row.departmentId !== null && row.departmentId !== undefined && scope.departmentIds.includes(row.departmentId));
  const employeeAllowed = scope.employeeIds.length === 0 || (employeeId !== undefined && scope.employeeIds.includes(employeeId));
  return branchAllowed && departmentAllowed && employeeAllowed;
}
