export const retailPermissions = [
  "retail.admin.view",
  "retail.access.manage",
  "retail.outlets.manage",
  "retail.users.manage",
  "retail.visibility.manage",
  "retail.orders.manage",
  "retail.analytics.view",
] as const;

export type RetailPermission = (typeof retailPermissions)[number];

export function canUseRetailPermission(roleKey: string, permissions: string[] | undefined, permission: RetailPermission) {
  const prefix = permission.split(".")[0];
  return roleKey === "owner" || permissions?.includes("*") || permissions?.includes(permission) || permissions?.includes(`${prefix}.*`) || false;
}
