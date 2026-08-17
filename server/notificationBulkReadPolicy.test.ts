import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/erp.ts"), "utf8");

describe("سياسة تحديد كل الإشعارات كمقروء", () => {
  it("تقيد التحديث بالمؤسسة والإشعارات غير المقروءة فقط", () => {
    expect(dbSource).toContain("markAllNotificationsRead");
    expect(dbSource).toContain("eq(notifications.organizationId, organizationId)");
    expect(dbSource).toContain('eq(notifications.isRead, "no")');
  });

  it("يشتق المؤسسة خادمياً من العضوية ولا يقبل معرف مؤسسة من المتصفح", () => {
    expect(routerSource).toContain("markAllRead: protectedProcedure.mutation");
    expect(routerSource).toContain("markAllNotificationsRead(context.organization.id)");
    expect(routerSource).not.toContain("markAllRead: protectedProcedure.input");
  });
});
