import { describe, expect, it } from "vitest";
import { canUseHrPermission } from "./hrPermissionPolicy";

describe("سياسة صلاحيات الموارد البشرية", () => {
  it("تسمح بالخدمة الذاتية للموظف وتفصل اعتماد الفريق عن تصدير الرواتب البنكي", () => {
    expect(canUseHrPermission("employee_self_service", ["hr.self.view", "hr.self.leave.request"], "hr.self.leave.request")).toBe(true);
    expect(canUseHrPermission("line_manager", ["hr.leave.approve_team"], "hr.leave.approve_team")).toBe(true);
    expect(canUseHrPermission("line_manager", ["hr.leave.approve_team"], "hr.payroll.export_bank")).toBe(false);
    expect(canUseHrPermission("owner", [], "hr.payroll.export_bank")).toBe(true);
  });
});
