export const hrPermissions = [
  "hr.directory.view", "hr.directory.manage", "hr.attendance.view", "hr.attendance.manage",
  "hr.leave.view", "hr.leave.manage", "hr.leave.approve_team", "hr.overtime.view", "hr.overtime.manage", "hr.overtime.approve_team",
  "hr.advance.view", "hr.advance.request", "hr.advance.approve_team", "hr.payroll.view", "hr.payroll.manage", "hr.payroll.export_bank",
  "hr.self.view", "hr.self.leave.request", "hr.self.advance.request",
] as const;

export type HrPermission = (typeof hrPermissions)[number];

export const hrRolePresets = {
  hr_manager: ["hr.directory.view", "hr.directory.manage", "hr.attendance.view", "hr.attendance.manage", "hr.leave.view", "hr.leave.manage", "hr.overtime.view", "hr.overtime.manage", "hr.advance.view", "hr.payroll.view", "hr.payroll.manage", "hr.payroll.export_bank"],
  hr_officer: ["hr.directory.view", "hr.attendance.view", "hr.attendance.manage", "hr.leave.view", "hr.leave.manage", "hr.overtime.view", "hr.overtime.manage", "hr.advance.view"],
  line_manager: ["hr.directory.view", "hr.attendance.view", "hr.leave.view", "hr.leave.approve_team", "hr.overtime.view", "hr.overtime.approve_team"],
  employee_self_service: ["hr.self.view", "hr.self.leave.request", "hr.self.advance.request"],
} as const satisfies Record<string, readonly HrPermission[]>;

export function canUseHrPermission(roleKey: string, permissions: string[] | undefined, permission: HrPermission) {
  return roleKey === "owner" || permissions?.includes("*") || permissions?.includes(permission) || permissions?.includes("hr.*") || false;
}
