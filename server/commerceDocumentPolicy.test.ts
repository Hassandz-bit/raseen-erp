import { describe, expect, it } from "vitest";
import { canTransitionPurchaseDocument, canTransitionStockCount } from "./commerceDocumentPolicy";

describe("commerce document transitions", () => {
  it("guards purchasing and receiving transitions", () => {
    expect(canTransitionPurchaseDocument("draft", "sent")).toBe(true);
    expect(canTransitionPurchaseDocument("sent", "partial")).toBe(true);
    expect(canTransitionPurchaseDocument("partial", "received")).toBe(true);
    expect(canTransitionPurchaseDocument("draft", "received")).toBe(false);
    expect(canTransitionPurchaseDocument("received", "sent")).toBe(false);
  });

  it("allows stock counts only through controlled review and posting", () => {
    expect(canTransitionStockCount("in_progress", "review")).toBe(true);
    expect(canTransitionStockCount("review", "approved")).toBe(true);
    expect(canTransitionStockCount("draft", "approved")).toBe(false);
  });
});
