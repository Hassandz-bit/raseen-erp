export type MembershipStatus = "active" | "invited" | "suspended";
export type SubscriptionStatus = "active" | "suspended" | "expired";

export function hasActiveMembership(status: MembershipStatus | undefined) {
  return status === "active";
}

export function hasActiveModule(status: SubscriptionStatus | undefined) {
  return status === "active";
}

export function canAccessTenantModule({
  membershipStatus,
  moduleStatus,
}: {
  membershipStatus: MembershipStatus | undefined;
  moduleStatus: SubscriptionStatus | undefined;
}) {
  return hasActiveMembership(membershipStatus) && hasActiveModule(moduleStatus);
}

export type OperationalMetrics = {
  lowStockProducts: number;
  overdueInvoices: number;
  budgetExceeded: boolean;
  currentMonthExpenses: number;
  monthlyBudget: number;
};

export function buildOwnerAlertReasons(metrics: OperationalMetrics) {
  const reasons: string[] = [];
  if (metrics.lowStockProducts > 0) reasons.push(`يوجد ${metrics.lowStockProducts} صنفاً قريباً من حد إعادة الطلب.`);
  if (metrics.overdueInvoices > 0) reasons.push(`يوجد ${metrics.overdueInvoices} فاتورة مستحقة المتابعة.`);
  if (metrics.budgetExceeded) reasons.push(`بلغت مصروفات الشهر ${metrics.currentMonthExpenses} وتجاوزت سقف الميزانية ${metrics.monthlyBudget}.`);
  return reasons;
}
