export const distributionPermissions = [
  "distribution.view", "distribution.createRoute", "distribution.editRoute", "distribution.assignVehicle", "distribution.createLoad", "distribution.approveLoad", "distribution.deliver", "distribution.collect", "distribution.closeRoute", "distribution.approveClose", "distribution.reopenRoute",
  "fleet.view", "fleet.editVehicle", "fleet.fuel", "fleet.maintenance", "fleet.expenses", "fleet.documents",
] as const;

export type DistributionPermission = (typeof distributionPermissions)[number];

export function canUseDistributionPermission(roleKey: string, permissions: string[] | undefined, permission: DistributionPermission) {
  return roleKey === "owner" || permissions?.includes("*") || permissions?.includes(permission) || permissions?.includes(permission.split(".")[0] + ".*") || false;
}

export function isScopedIdAllowed(scope: { branchIds?: number[]; territoryIds?: number[]; vehicleIds?: number[]; assignedRouteIds?: number[] } | null | undefined, key: "branchIds" | "territoryIds" | "vehicleIds" | "assignedRouteIds", id: number | undefined) {
  if (!id) return true;
  const allowed = scope?.[key];
  return !allowed?.length || allowed.includes(id);
}

export type LoadCapacity = { totalWeight: number; totalVolume: number; totalPackages: number; payloadUtilization: number; volumeUtilization: number; remainingPayload: number; remainingVolume: number; overloaded: boolean };

export function calculateLoadCapacity(lines: Array<{ quantity: number; unitWeight: number; unitVolume: number; packages: number }>, vehicle: { maximumPayloadWeight: number; maximumVolume: number }): LoadCapacity {
  const totalWeight = lines.reduce((sum, line) => sum + line.quantity * line.unitWeight, 0);
  const totalVolume = lines.reduce((sum, line) => sum + line.quantity * line.unitVolume, 0);
  const totalPackages = lines.reduce((sum, line) => sum + line.packages, 0);
  const payloadUtilization = vehicle.maximumPayloadWeight > 0 ? totalWeight / vehicle.maximumPayloadWeight : 0;
  const volumeUtilization = vehicle.maximumVolume > 0 ? totalVolume / vehicle.maximumVolume : 0;
  return { totalWeight, totalVolume, totalPackages, payloadUtilization, volumeUtilization, remainingPayload: Math.max(0, vehicle.maximumPayloadWeight - totalWeight), remainingVolume: Math.max(0, vehicle.maximumVolume - totalVolume), overloaded: payloadUtilization > 1 || volumeUtilization > 1 };
}

const routeTransitions: Record<string, string[]> = { planned: ["prepared", "cancelled"], prepared: ["loaded", "cancelled"], loaded: ["started", "cancelled"], started: ["in_progress", "returning"], in_progress: ["returning"], returning: ["closing"], closing: ["closed"], closed: [], cancelled: [] };
const loadTransitions: Record<string, string[]> = { draft: ["prepared", "cancelled"], prepared: ["approved", "cancelled"], approved: ["loading", "cancelled"], loading: ["loaded", "cancelled"], loaded: ["dispatched", "closed"], dispatched: ["closed"], closed: [], cancelled: [] };
const closingTransitions: Record<string, string[]> = { submitted: ["reviewed", "reopened"], reviewed: ["approved", "reopened"], approved: ["closed", "reopened"], closed: [], reopened: ["submitted"] };

export function canTransitionDistributionRoute(from: string, to: string) { return routeTransitions[from]?.includes(to) ?? false; }
export function canTransitionVehicleLoad(from: string, to: string) { return loadTransitions[from]?.includes(to) ?? false; }
export function canTransitionRouteClosing(from: string, to: string) { return closingTransitions[from]?.includes(to) ?? false; }
