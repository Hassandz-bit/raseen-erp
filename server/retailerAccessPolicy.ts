export const retailerPermissions = [
  "retail.catalog.view", "retail.prices.view", "retail.promotions.view", "retail.orders.view", "retail.orders.create", "retail.orders.cancel", "retail.invoices.view", "retail.delivery_notes.view", "retail.statement.view", "retail.debt.view", "retail.outlets.view", "retail.outlets.manage", "retail.users.manage",
] as const;

export type RetailerPermission = (typeof retailerPermissions)[number];
export type RetailerRole = "owner" | "buyer" | "accountant" | "store_manager" | "viewer";

const rolePermissions: Record<RetailerRole, ReadonlySet<RetailerPermission>> = {
  owner: new Set<RetailerPermission>(retailerPermissions),
  buyer: new Set<RetailerPermission>(["retail.catalog.view", "retail.prices.view", "retail.promotions.view", "retail.orders.view", "retail.orders.create", "retail.orders.cancel", "retail.outlets.view"]),
  accountant: new Set<RetailerPermission>(["retail.invoices.view", "retail.delivery_notes.view", "retail.statement.view", "retail.debt.view", "retail.orders.view"]),
  store_manager: new Set<RetailerPermission>(["retail.catalog.view", "retail.prices.view", "retail.promotions.view", "retail.orders.view", "retail.orders.create", "retail.orders.cancel", "retail.outlets.view"]),
  viewer: new Set<RetailerPermission>(["retail.catalog.view", "retail.prices.view", "retail.promotions.view", "retail.orders.view", "retail.outlets.view"]),
};

export function canUseRetailerPermission(role: RetailerRole, overrides: Record<string, boolean> | null | undefined, permission: RetailerPermission) {
  if (overrides?.[permission] !== undefined) return overrides[permission] === true;
  return rolePermissions[role].has(permission);
}

export function isOutletAllowedForRetailer(role: RetailerRole, outletIds: number[] | null | undefined, outletId: number | undefined) {
  if (!outletId || role === "owner") return true;
  return Boolean(outletIds?.includes(outletId));
}
