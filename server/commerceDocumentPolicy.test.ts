import { describe, expect, it } from "vitest";
import { canTransitionPurchaseDocument, canTransitionStockCount } from "./commerceDocumentPolicy";

describe("commerce document transitions", () => {
  it("guards purchasing and receiving transitions", () => {
    expect(canTransitionPurchaseDocument("draft", "approved")).toBe(true);
    expect(canTransitionPurchaseDocument("received", "ordered")).toBe(false);
  });

  it("allows stock counts only through controlled review and posting", () => {
    expect(canTransitionStockCount("counting", "review")).toBe(true);
    expect(canTransitionStockCount("draft", "posted")).toBe(false);
  });
});
