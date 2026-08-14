import { describe, expect, it } from "vitest";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership, hasActiveModule } from "./tenantPolicy";

describe("tenantPolicy", () => {
  it("يسمح بالوحدة فقط عند وجود عضوية واشتراك نشطين", () => {
    expect(canAccessTenantModule({ membershipStatus: "active", moduleStatus: "active" })).toBe(true);
    expect(canAccessTenantModule({ membershipStatus: "suspended", moduleStatus: "active" })).toBe(false);
    expect(canAccessTenantModule({ membershipStatus: "active", moduleStatus: "suspended" })).toBe(false);
    expect(canAccessTenantModule({ membershipStatus: "active", moduleStatus: "expired" })).toBe(false);
  });

  it("لا يعامل حالات الدعوة أو الحالة غير المعروفة كنفاذ صالح", () => {
    expect(hasActiveMembership("invited")).toBe(false);
    expect(hasActiveMembership(undefined)).toBe(false);
    expect(hasActiveModule(undefined)).toBe(false);
  });

  it("يبني تنبيه المالك من حالات التشغيل الحرجة فقط", () => {
    expect(buildOwnerAlertReasons({ lowStockProducts: 0, overdueInvoices: 0, budgetExceeded: false, currentMonthExpenses: 0, monthlyBudget: 0 })).toEqual([]);
    expect(buildOwnerAlertReasons({ lowStockProducts: 2, overdueInvoices: 1, budgetExceeded: true, currentMonthExpenses: 16000, monthlyBudget: 12000 })).toEqual([
      "يوجد 2 صنفاً قريباً من حد إعادة الطلب.",
      "يوجد 1 فاتورة مستحقة المتابعة.",
      "بلغت مصروفات الشهر 16000 وتجاوزت سقف الميزانية 12000.",
    ]);
  });
});
