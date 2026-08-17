import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insertValues: vi.fn(), invokeLLMMock: vi.fn() }));

vi.mock("./db", () => ({ getDb: vi.fn(async () => ({ insert: () => ({ values: mocks.insertValues }) })) }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLMMock }));

import { askNawaAI } from "./nawaAI";

describe("Nawa AI isolation contract", () => {
  beforeEach(() => {
    mocks.insertValues.mockReset().mockResolvedValue(undefined);
    mocks.invokeLLMMock.mockReset();
  });

  it("يرسل السياق المصرح به فقط ويثبت موافقة بشرية للمخرج المنظم", async () => {
    mocks.invokeLLMMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ recommendation: "مراجعة مخزون الصنف أ", confidence: "medium", evidence: ["مخزون منخفض"], proposedAction: "إنشاء طلب شراء", requiresHumanApproval: true }) } }] });
    const result = await askNawaAI({ organizationId: 11, userId: 7, feature: "inventory", prompt: "حلل المخزون", safeContext: { lowStockProducts: 3, bankAccount: undefined } });
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.proposedAction).toBe("إنشاء طلب شراء");
    expect(result.status).toBe("completed");
    expect(mocks.invokeLLMMock.mock.calls[0][0].messages[1].content).toContain('"lowStockProducts":3');
    expect(mocks.invokeLLMMock.mock.calls[0][0].messages[0].content).toContain("لا تنفذ عمليات");
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 11, actorUserId: 7, action: "nawa_ai.completed" }));
  });

  it("يتعطل بأمان عند فشل المزود ولا ينشئ توصية تنفيذية", async () => {
    mocks.invokeLLMMock.mockRejectedValue(new Error("provider unavailable"));
    const result = await askNawaAI({ organizationId: 12, userId: 8, feature: "finance", prompt: "حلل مالي", safeContext: { revenue: 100 } });
    expect(result.status).toBe("unavailable");
    expect(result.proposedAction).toBeNull();
    expect(result.requiresHumanApproval).toBe(true);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 12, actorUserId: 8, action: "nawa_ai.unavailable" }));
  });
});
