import { describe, expect, it } from "vitest";
import { formatOperationalStatus } from "./operationalStatus";

describe("تسميات الحالات التشغيلية", () => {
  it("يعرض الحالة المحلية بدلاً من شارة فارغة في البوابات التشغيلية", () => {
    expect(formatOperationalStatus("ar", "closed")).toBe("مغلقة");
    expect(formatOperationalStatus("ar", "quality_hold")).toBe("قيد الجودة");
    expect(formatOperationalStatus("fr", "in_production")).toBe("En production");
  });

  it("يعرض بديلاً قابلاً للقراءة للحالة غير المتوقعة", () => {
    expect(formatOperationalStatus("en", "awaiting_review")).toBe("awaiting review");
    expect(formatOperationalStatus("en", undefined)).toBe("—");
  });
});
