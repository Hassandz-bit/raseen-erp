import { describe, expect, it, vi } from "vitest";

const { getDefaultTenantContext } = vi.hoisted(() => ({ getDefaultTenantContext: vi.fn() }));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDefaultTenantContext,
}));

import { requireOrganizationOwner } from "./erp";

describe("حراسة مالك المؤسسة لإجراءات الفروع", () => {
  it("تسمح للمالك وترفض العضو قبل الوصول إلى إجراءات الإعدادات", async () => {
    const ownerContext = { organization: { id: 71 }, membership: { roleKey: "owner", status: "active" }, modules: [] };
    getDefaultTenantContext.mockResolvedValueOnce(ownerContext);
    await expect(requireOrganizationOwner(10)).resolves.toEqual(ownerContext);

    getDefaultTenantContext.mockResolvedValueOnce({ organization: { id: 71 }, membership: { roleKey: "member", status: "active" }, modules: [] });
    await expect(requireOrganizationOwner(11)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
