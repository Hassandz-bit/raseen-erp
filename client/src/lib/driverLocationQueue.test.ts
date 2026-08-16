import { beforeEach, describe, expect, it } from "vitest";
import { getQueuedDriverLocations, queueDriverLocation, removeQueuedDriverLocations } from "./driverLocationQueue";

describe("driverLocationQueue", () => {
  const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key), clear: () => void values.clear(), key: () => null, get length() { return values.size; } };
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  });

  it("يحفظ نقاط الجولة محلياً ويزيل فقط النقاط التي أُكدت مزامنتها", () => {
    queueDriverLocation({ routeId: 7, vehicleId: 3, latitude: 36.75, longitude: 3.05, accuracy: 8, recordedAt: "2026-08-16T12:00:00.000Z" });
    queueDriverLocation({ routeId: 7, vehicleId: 3, latitude: 36.76, longitude: 3.06, recordedAt: "2026-08-16T12:01:00.000Z" });
    queueDriverLocation({ routeId: 8, vehicleId: 4, latitude: 35.1, longitude: 2.9, recordedAt: "2026-08-16T12:02:00.000Z" });
    const routeSeven = getQueuedDriverLocations(7);
    expect(routeSeven).toHaveLength(2);
    expect(getQueuedDriverLocations(8)).toHaveLength(1);
    removeQueuedDriverLocations(7, [routeSeven[0].id]);
    expect(getQueuedDriverLocations(7)).toHaveLength(1);
    expect(getQueuedDriverLocations(8)).toHaveLength(1);
  });
});
