import { beforeEach, describe, expect, it } from "vitest";
import { getDriverOperationQueue, markDriverOperation, queueDriverOperation, removeDriverOperations } from "./driverOperationQueue";

describe("driverOperationQueue", () => {
  const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key), clear: () => void values.clear(), key: () => null, get length() { return values.size; } };
  beforeEach(() => { values.clear(); Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } }); });
  it("يعزل العمليات حسب الجولة ويصنف العملية المتعارضة قبل إزالة المؤكدة", () => {
    queueDriverOperation({ routeId: 7, kind: "delivery", payload: { stopId: 4, idempotencyKey: "op-1" } });
    queueDriverOperation({ routeId: 8, kind: "collection", payload: { stopId: 9, idempotencyKey: "op-2" } });
    const [operation] = getDriverOperationQueue(7);
    expect(markDriverOperation(7, operation.id, "needs_refresh")[0].status).toBe("needs_refresh");
    expect(removeDriverOperations(7, [operation.id])).toHaveLength(0);
    expect(getDriverOperationQueue(8)).toHaveLength(1);
  });
});
