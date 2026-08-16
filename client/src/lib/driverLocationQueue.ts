export type QueuedDriverLocation = {
  id: string;
  routeId: number;
  vehicleId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: string;
};

const maxQueuedLocations = 200;
const queueKey = (routeId: number) => `nawa.driver.location-queue.${routeId}`;

function readQueue(routeId: number): QueuedDriverLocation[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(queueKey(routeId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(point => Number.isInteger(point.routeId) && Number.isInteger(point.vehicleId) && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) : [];
  } catch {
    return [];
  }
}

export function getQueuedDriverLocations(routeId: number) {
  if (typeof window === "undefined") return [];
  return readQueue(routeId);
}

export function queueDriverLocation(point: Omit<QueuedDriverLocation, "id">) {
  if (typeof window === "undefined") return 0;
  const queue = readQueue(point.routeId);
  const next = [...queue, { ...point, id: `${point.routeId}-${point.recordedAt}-${crypto.randomUUID()}` }].slice(-maxQueuedLocations);
  window.localStorage.setItem(queueKey(point.routeId), JSON.stringify(next));
  return next.length;
}

export function removeQueuedDriverLocations(routeId: number, ids: string[]) {
  if (typeof window === "undefined") return 0;
  const accepted = new Set(ids);
  const remaining = readQueue(routeId).filter(point => !accepted.has(point.id));
  window.localStorage.setItem(queueKey(routeId), JSON.stringify(remaining));
  return remaining.length;
}

export function clearQueuedDriverLocations(routeId: number) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(queueKey(routeId));
}
