import { describe, expect, it } from "vitest";
import { getFlowNodeStatus, nawaFlowNodes } from "./nawaFlowConfig";

describe("Nawa Flow configuration", () => {
  const commerce = nawaFlowNodes.find(node => node.id === "commerce")!;
  it("marks a supported and subscribed node as available", () => {
    expect(getFlowNodeStatus(commerce, [{ key: "purchases", status: "active" }, { key: "inventory", status: "active" }, { key: "sales", status: "active" }])).toBe("available");
  });
  it("keeps unavailable subscriptions locked and supports a stricter restricted display", () => {
    expect(getFlowNodeStatus(commerce, [{ key: "purchases", status: "active" }])).toBe("locked");
    expect(getFlowNodeStatus(commerce, [{ key: "purchases", status: "active" }, { key: "inventory", status: "active" }, { key: "sales", status: "active" }], ["commerce"])).toBe("restricted");
  });
});
