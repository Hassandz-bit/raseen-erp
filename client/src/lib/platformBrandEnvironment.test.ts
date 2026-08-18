import { describe, expect, it } from "vitest";

describe("إعداد علامة المنصة", () => {
  it("يعرض عنوان العميل الجديد RASEEN ERP من البيئة", () => {
    expect(process.env.VITE_APP_TITLE).toBe("RASEEN ERP");
  });
});
