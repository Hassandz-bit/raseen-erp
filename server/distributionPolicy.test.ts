import { describe, expect, it } from "vitest";
import { calculateLoadCapacity, canTransitionDistributionRoute, canTransitionRouteClosing, canTransitionVehicleLoad, canUseDistributionPermission, isScopedIdAllowed } from "./distributionPolicy";

describe("distribution policy", () => {
  it("calculates payload and volume utilization and detects overload", () => {
    const result = calculateLoadCapacity([{ quantity: 12, unitWeight: 10, unitVolume: 2, packages: 3 }], { maximumPayloadWeight: 100, maximumVolume: 20 });
    expect(result.totalWeight).toBe(120);
    expect(result.totalVolume).toBe(24);
    expect(result.payloadUtilization).toBe(1.2);
    expect(result.volumeUtilization).toBe(1.2);
    expect(result.overloaded).toBe(true);
  });

  it("allows only controlled transitions for route, load, and closing", () => {
    expect(canTransitionDistributionRoute("planned", "prepared")).toBe(true);
    expect(canTransitionDistributionRoute("closed", "started")).toBe(false);
    expect(canTransitionVehicleLoad("loaded", "dispatched")).toBe(true);
    expect(canTransitionVehicleLoad("draft", "dispatched")).toBe(false);
    expect(canTransitionRouteClosing("approved", "closed")).toBe(true);
    expect(canTransitionRouteClosing("closed", "reopened")).toBe(false);
  });

  it("requires a granted permission and respects explicit distribution scopes", () => {
    expect(canUseDistributionPermission("member", ["distribution.deliver"], "distribution.deliver")).toBe(true);
    expect(canUseDistributionPermission("member", ["distribution.view"], "fleet.editVehicle")).toBe(false);
    expect(canUseDistributionPermission("owner", [], "fleet.editVehicle")).toBe(true);
    expect(isScopedIdAllowed({ vehicleIds: [4] }, "vehicleIds", 4)).toBe(true);
    expect(isScopedIdAllowed({ vehicleIds: [4] }, "vehicleIds", 9)).toBe(false);
  });
});
