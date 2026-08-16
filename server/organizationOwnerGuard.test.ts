import { describe, expect, it, vi } from "vitest";

const { getDefaultTenantContext, getOrganizationRolePermissions } = vi.hoisted(() => ({ getDefaultTenantContext: vi.fn(), getOrganizationRolePermissions: vi.fn() }));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDefaultTenantContext,
  getOrganizationRolePermissions,
}));

import { requireManufacturingOwner, requireManufacturingPermission, requireModule, requireOrganizationOwner } from "./erp";

describe("حراسة مالك المؤسسة لإجراءات الفروع", () => {
  it("تسمح للمالك وترفض العضو قبل الوصول إلى إجراءات الإعدادات", async () => {
    const ownerContext = { organization: { id: 71 }, membership: { roleKey: "owner", status: "active" }, modules: [] };
    getDefaultTenantContext.mockResolvedValueOnce(ownerContext);
    await expect(requireOrganizationOwner(10)).resolves.toEqual(ownerContext);

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 71 }, membership: { roleKey: "member", status: "active" }, modules: [] });
    await expect(requireOrganizationOwner(11)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("حراسة الوحدة التشغيلية", () => {
  it("تسمح للوحدة المفعلة وترفض الوحدة المعلقة أو الغائبة", async () => {
    const activeContext = { organization: { id: 72 }, membership: { roleKey: "owner", status: "active" }, modules: [{ moduleKey: "inventory", status: "active" }] };
    getDefaultTenantContext.mockResolvedValueOnce(activeContext);
    await expect(requireModule(12, "inventory")).resolves.toEqual(activeContext);

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 72 }, membership: { roleKey: "owner", status: "active" }, modules: [{ moduleKey: "inventory", status: "suspended" }] });
    await expect(requireModule(12, "inventory")).rejects.toMatchObject({ code: "FORBIDDEN" });

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 72 }, membership: { roleKey: "owner", status: "active" }, modules: [] });
    await expect(requireModule(12, "inventory")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("حراسة التصنيع", () => {
  it("تتطلب اشتراك التصنيع المفعّل ودور مالك المؤسسة", async () => {
    const allowedContext = { organization: { id: 73 }, membership: { roleKey: "owner", status: "active" }, modules: [{ moduleKey: "manufacturing", status: "active" }] };
    getDefaultTenantContext.mockResolvedValueOnce(allowedContext);
    await expect(requireManufacturingOwner(13)).resolves.toEqual(allowedContext);

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 73 }, membership: { roleKey: "owner", status: "active" }, modules: [{ moduleKey: "manufacturing", status: "suspended" }] });
    await expect(requireManufacturingOwner(13)).rejects.toMatchObject({ code: "FORBIDDEN" });

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 73 }, membership: { roleKey: "member", status: "active" }, modules: [{ moduleKey: "manufacturing", status: "active" }] });
    await expect(requireManufacturingOwner(13)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("تسمح لمدير الإنتاج بالصلاحية الممنوحة وترفض الموظف العادي", async () => {
    const managerContext = { organization: { id: 74 }, membership: { roleKey: "production_manager", status: "active" }, modules: [{ moduleKey: "manufacturing", status: "active" }] };
    getDefaultTenantContext.mockResolvedValueOnce(managerContext);
    getOrganizationRolePermissions.mockResolvedValueOnce(["manufacturing.order.approve"]);
    await expect(requireManufacturingPermission(14, "manufacturing.order.approve")).resolves.toEqual(managerContext);

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 74 }, membership: { roleKey: "member", status: "active" }, modules: [{ moduleKey: "manufacturing", status: "active" }] });
    getOrganizationRolePermissions.mockResolvedValueOnce(["manufacturing.view"]);
    await expect(requireManufacturingPermission(15, "manufacturing.order.approve")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
