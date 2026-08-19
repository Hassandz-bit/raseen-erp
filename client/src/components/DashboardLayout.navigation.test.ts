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

  it("يربط الرأس بسياق المؤسسة دون أي معرف عميل", () => {
    expect(source).toContain("bootstrap.data?.organization?.name");
    expect(source).not.toContain("organizationId=");
  });

  it("يوفر انتقالاً واحداً واضحاً لمساحة Nawa AI ويحذف مبدل البوابات المكرر", () => {
    expect(source).toContain("chrome.ai");
    expect(source).toContain('navigate("/workspace")');
    expect(source).not.toContain("placeholder={chrome.search}");
    expect(source).not.toContain("nawaPortals.map(portal");
  });

  it("يعرض Rail نشطاً وعداد تنبيهات خادمي", () => {
    expect(source).toContain("nawa-rail-button-active");
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
    expect(source).toContain("nawa-global-header");
    expect(source).toContain("nawa-wordmark");
    expect(source).toContain("nawa-organization-switcher");
  });

  it("يوفر إجراء طباعة عاماً لكل صفحة داخل التخطيط الموحد", () => {
    expect(source).toContain("PagePrintPreview");
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
    expect(source).toContain('setToolQuery(event.target.value)');
    expect(source).toContain("nawa-context-panel");
    expect(source).toContain("nawa-context-tool");
  });

  it("يثبت الرأس العلوي فوق المحتوى أثناء التمرير", () => {
    expect(source).toContain("nawa-global-header");
  });

  it("يدعم أوضاع AUTO وEXPANDED وCOMPACT كتفضيل شخصي محفوظ", () => {
    expect(source).toContain('const NAVIGATION_MODE_KEY = "nawa:navigation-mode"');
    expect(source).toContain('type NavigationMode = "auto" | "expanded" | "compact"');
    expect(source).toContain("effectiveNavigationMode");
    expect(source).toContain("localStorage.setItem(preferenceKey, navigationMode)");
  });

  it("يوسع بوابة النظرة العامة ويصغر صفحات العمل تلقائياً مع تثبيت اختياري", () => {
    expect(source).toContain("const isPortalOverview");
    expect(source).toContain('isPortalOverview ? "expanded" : "compact"');
    expect(source).toContain("nawa-navigation-rail-expanded");
    expect(source).toContain("chrome.pinNav");
    expect(source).toContain("chrome.unpinNav");
  });

  it("يفتح أدوات المجموعة بالنقر والتمرير ويجعل Drawer الهاتف نصياً", () => {
    expect(source).toContain("onPointerEnter");
    expect(source).toContain("setTimeout(() => openGroup(group.key), 240)");
    expect(source).toContain("navigationRendersExpanded");
    expect(source).toContain("setRailOpenOnMobile(true)");
  });

  it("يوفر Command Palette واختصار Ctrl أو Cmd مع بحث صفحات محكوم", () => {
    expect(source).toContain("CommandDialog");
    expect(source).toContain("event.ctrlKey || event.metaKey");
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain("allowedPortals");
    expect(source).not.toContain("trpc.erp.globalSearch");
  });
});
