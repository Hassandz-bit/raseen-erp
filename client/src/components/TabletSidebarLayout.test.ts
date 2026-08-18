import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/sidebar.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("لوحة الشريط في الوضع اللوحي", () => {
  it("تستخدم عرضاً آمناً ولوحة بارتفاع الشاشة مع احتواء التمرير", () => {
    expect(sidebarSource).toContain('const SIDEBAR_WIDTH_MOBILE = "min(88vw, 26rem)"');
    expect(sidebarSource).toContain("max-w-[calc(100vw-0.75rem)] overflow-hidden");
    expect(sidebarSource).toContain('h-[100dvh] min-h-0 w-full flex-col overflow-hidden');
  });

  it("يثبت الرأس والتذييل ويجعل قائمة الأدوات هي منطقة التمرير الوحيدة", () => {
    expect(layoutSource).toContain('SidebarHeader className="h-[72px] shrink-0');
    expect(layoutSource).toContain('SidebarContent className="min-h-0 gap-0 overscroll-contain overflow-y-auto"');
    expect(layoutSource).toContain('SidebarFooter className="shrink-0 p-3"');
    expect(layoutSource).toContain('className="min-w-0 truncate"');
  });
});
