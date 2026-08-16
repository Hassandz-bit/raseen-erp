export type DriverOperationKind = "arrival" | "delivery" | "collection" | "return" | "expense" | "closing" | "proof_metadata";
export type DriverQueuedOperation = { id: string; routeId: number; kind: DriverOperationKind; payload: Record<string, unknown>; createdAt: string; attempts: number; status: "pending" | "needs_refresh" | "supervisor_review" };

const retentionMs = 7 * 24 * 60 * 60 * 1000;
const maxItems = 100;
const key = (routeId: number) => `nawa.driver.operation-queue.${routeId}`;

function read(routeId: number): DriverQueuedOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key(routeId)) ?? "[]");
    const threshold = Date.now() - retentionMs;
    return Array.isArray(value) ? value.filter(item => item && item.routeId === routeId && typeof item.createdAt === "string" && new Date(item.createdAt).getTime() >= threshold) : [];
  } catch { return []; }
}

export function getDriverOperationQueue(routeId: number) { return read(routeId); }
export function queueDriverOperation(input: Omit<DriverQueuedOperation, "id" | "createdAt" | "attempts" | "status">) {
  if (typeof window === "undefined") return 0;
  const next = [...read(input.routeId), { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0, status: "pending" as const }].slice(-maxItems);
  window.localStorage.setItem(key(input.routeId), JSON.stringify(next));
  return next.length;
}
export function markDriverOperation(routeId: number, id: string, status: DriverQueuedOperation["status"]) {
  const next = read(routeId).map(item => item.id === id ? { ...item, status, attempts: item.attempts + 1 } : item);
  if (typeof window !== "undefined") window.localStorage.setItem(key(routeId), JSON.stringify(next));
  return next;
}
export function removeDriverOperations(routeId: number, ids: string[]) {
  const removed = new Set(ids); const next = read(routeId).filter(item => !removed.has(item.id));
  if (typeof window !== "undefined") window.localStorage.setItem(key(routeId), JSON.stringify(next));
  return next;
}
export function clearDriverOperationQueue(routeId: number) { if (typeof window !== "undefined") window.localStorage.removeItem(key(routeId)); }
