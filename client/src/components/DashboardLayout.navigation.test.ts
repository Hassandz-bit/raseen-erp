import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const railSource = readFileSync(resolve(process.cwd(), "client/src/components/PortalNavigationRail.tsx"), "utf8");
const headerSource = readFileSync(resolve(process.cwd(), "client/src/components/AppHeader.tsx"), "utf8");

describe("تنقل بوابات Nawa", () => {
  it("يستمد البوابة والتنقل المحلي من تعريف مركزي", () => {
    expect(source).toContain("getPortalForPath");
    expect(source).toContain("activePortal?.localNavigation");
    expect(source).not.toContain('navigate("/workspace")');
  });

  it("يبقي الرئيسية خفيفة ولا يعيد القائمة العالمية السابقة", () => {
    expect(source).toContain("chrome.portals");
    expect(source).not.toContain("const menuItems = [");
  });

  it("يربط الرأس بسياق المؤسسة دون أي معرف عميل", () => {
    expect(source).toContain("bootstrap.data?.organization?.name");
    expect(source).not.toContain("organizationId=");
  });

  it("لا يعرض انتقالاً إلى مساحة ذكاء رصين المسحوبة ويحذف مبدل البوابات المكرر", () => {
    expect(source).not.toContain('navigate("/workspace")');
    expect(source).not.toContain("<Bot");
    expect(source).not.toContain("placeholder={chrome.search}");
    expect(source).not.toContain("nawaPortals.map(portal");
  });

  it("يعرض Rail نشطاً وعداد تنبيهات خادمي", () => {
    expect(railSource).toContain("nawa-rail-button-active");
    expect(source).toContain("trpc.erp.notifications.list.useQuery");
    expect(source).toContain("refetchInterval: 30_000");
    expect(source).toContain("unreadCount");
  });

  it("يعرض قائمة الإشعارات ويتيح تحديد الكل كمقروء", () => {
    expect(source).toContain("trpc.erp.notifications.markAllRead.useMutation");
    expect(source).toContain("markAllRead.mutate()");
    expect(source).toContain("chrome.markAllRead");
    expect(source).toContain("chrome.emptyNotifications");
    expect(source).toContain("markRead.mutate({ notificationId: notification.id })");
  });

  it("يعرض رأساً عالمياً مقتضباً واسم المؤسسة بوضوح", () => {
    expect(headerSource).toContain("nawa-global-header");
    expect(source).toContain("nawa-wordmark");
    expect(source).toContain("nawa-organization-switcher");
    expect(source).toContain("nawa-organization-inline-separator");
    expect(source).not.toContain("nawa-mobile-wordmark");
  });

  it("لا يعرض الطباعة في الرأس العام ويحافظ على ترويسة طباعة المستندات", () => {
    expect(source).not.toContain("PagePrintPreview");
    expect(source).toContain("organizationSettings.data?.documentSettings");
    expect(source).toContain("nawa-print-only");
  });

  it("يعرض منتقي الفروع من عقد محمي ويحفظ الاختيار المرئي", () => {
    expect(source).toContain("trpc.erp.preferences.availableBranches.useQuery");
    expect(source).toContain('const ACTIVE_BRANCH_KEY = "nawa:active-branch"');
    expect(source).toContain("setSelectedBranchId(branch.id)");
    expect(source).toContain("branches.data.map(branch");
    expect(source).toContain("OrganizationPicker");
  });

  it("يوفر بحثاً سياقياً ضمن لوحة أدوات البوابة", () => {
    expect(railSource).toContain("onToolQueryChange(event.target.value)");
    expect(railSource).toContain("nawa-context-panel");
    expect(railSource).toContain("nawa-context-tool");
  });

  it("يثبت الرأس العلوي فوق المحتوى أثناء التمرير", () => {
    expect(headerSource).toContain("nawa-global-header");
  });

  it("يدعم أوضاع AUTO وEXPANDED وCOMPACT كتفضيل شخصي محفوظ", () => {
    expect(source).toContain('const NAVIGATION_MODE_KEY = "nawa:navigation-mode"');
    expect(railSource).toContain('export type NavigationMode = "auto" | "expanded" | "compact"');
    expect(source).toContain("effectiveNavigationMode");
    expect(source).toContain("localStorage.setItem(preferenceKey, navigationMode)");
  });

  it("يوسع بوابة النظرة العامة ويصغر صفحات العمل تلقائياً مع تثبيت اختياري", () => {
    expect(source).toContain("const isPortalOverview");
    expect(source).toContain('isPortalOverview ? "expanded" : "compact"');
    expect(railSource).toContain("nawa-navigation-rail-expanded");
    expect(railSource).toContain("chrome.pinNav");
    expect(railSource).toContain("chrome.unpinNav");
  });

  it("يفتح أدوات المجموعة بالنقر والتمرير ويجعل Drawer الهاتف نصياً", () => {
    expect(railSource).toContain("onPointerEnter");
    expect(source).toContain("const scheduleGroupOpen");
    expect(railSource).toContain("onPointerEnter={() => onScheduleGroupOpen(group.key)}");
    expect(source).toContain("navigationRendersExpanded");
    expect(source).toContain("setRailOpenOnMobile(true)");
  });

  it("يوفر Command Palette واختصار Ctrl أو Cmd مع بحث صفحات محكوم", () => {
    expect(source).toContain("CommandDialog");
    expect(source).toContain("event.ctrlKey || event.metaKey");
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain("allowedPortals");
    expect(source).not.toContain("trpc.erp.globalSearch");
    expect(source).toContain("nawa-command-dialog-heading");
    expect(source).toContain("nawa-command-result-list");
    expect(source).toContain("localItems.slice(0, 6)");
  });
});
