import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("تنقل بوابات Nawa", () => {
  it("يستمد البوابة والتنقل المحلي من تعريف مركزي", () => {
    expect(source).toContain("getPortalForPath");
    expect(source).toContain("activePortal?.localNavigation");
    expect(source).toContain("chrome.ai");
  });

  it("يبقي الرئيسية خفيفة ولا يعيد القائمة العالمية السابقة", () => {
    expect(source).toContain("chrome.portals");
    expect(source).not.toContain("const menuItems = [");
  });

  it("يحفظ آخر بوابة ويربط الرأس بسياق المؤسسة دون أي معرف عميل", () => {
    expect(source).toContain('localStorage.setItem("nawa:last-portal"');
    expect(source).toContain("bootstrap.data?.organization?.name");
    expect(source).not.toContain("organizationId=");
  });

  it("يبقي Nawa AI في الشريط الجانبي فقط ويحذف البحث ومبدل البوابات المكرر", () => {
    expect(source).toContain("chrome.ai");
    expect(source.match(/navigateTo\("\/workspace", chrome\.ai\)/g)).toHaveLength(1);
    expect(source).toContain("chrome.workspace");
    expect(source).not.toContain("placeholder={chrome.search}");
    expect(source).not.toContain("nawaPortals.map(portal");
  });

  it("يعرض حالة نشاط وHover محسّنة لـ Nawa AI وعداد تنبيهات خادمي متحرك", () => {
    expect(source).toContain("group-hover/ai:scale-110");
    expect(source).toContain("shadow-[inset_3px_0_0_hsl(var(--primary))");
    expect(source).toContain("trpc.erp.notifications.list.useQuery");
    expect(source).toContain("refetchInterval: 30_000");
    expect(source).toContain("previousUnreadCount");
    expect(source).toContain('aria-live="polite"');
  });

  it("يعرض قائمة الإشعارات ويتيح تحديد الكل كمقروء", () => {
    expect(source).toContain("trpc.erp.notifications.markAllRead.useMutation");
    expect(source).toContain("markAllNotificationsRead.mutate()");
    expect(source).toContain("chrome.markAllRead");
    expect(source).toContain("chrome.emptyNotifications");
    expect(source).toContain("markNotificationRead.mutate({ notificationId: notification.id })");
  });

  it("يكبر هرمية عنوان الرأس وبيانات المؤسسة بوضوح", () => {
    expect(source).toContain('md:h-[88px]');
    expect(source).toContain('text-[21px] font-extrabold');
    expect(source).toContain('md:text-[26px]');
    expect(source).toContain('text-[16px] font-bold text-foreground md:text-[18px]');
  });

  it("يعرض منتقي الفروع من عقد محمي ويحفظ الاختيار المرئي", () => {
    expect(source).toContain("trpc.erp.preferences.availableBranches.useQuery");
    expect(source).toContain('const ACTIVE_BRANCH_KEY = "nawa:active-branch"');
    expect(source).toContain("setSelectedBranchId(branch.id)");
    expect(source).toContain("availableBranches.map(branch");
    expect(source).toContain('lg:hidden group-data-[collapsible=icon]:hidden');
  });
});
