import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(resolve(process.cwd(), `client/src/pages/${name}`), "utf8");

describe("حالات الفشل في الواجهات التشغيلية", () => {
  it("يعيد توجيه رابط مساحة العمل المسحوبة إلى الملخص التنفيذي", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/workspace"><Redirect to="/executive" /></Route>');
  });

  it("يعرض المالية والموارد البشرية وRetail خطأً وإجراء إعادة محاولة", () => {
    const finance = source("Finance.tsx");
    const hr = source("HRPayroll.tsx");
    const retailer = source("Retailer.tsx");
    expect(finance).toContain("hasLoadError");
    expect(finance).toContain("refresh");
    expect(hr).toContain("hasLoadError");
    expect(hr).toContain("bankExportError");
    expect(retailer).toContain("hasRetailError");
    expect(retailer).toContain("retryRetailData");
  });

  it("لا يخفي خطأ إعدادات الحمولة أو فشل إدارة علاقات Retail", () => {
    const distribution = source("Distribution.tsx");
    const management = source("B2BOrders.tsx");
    expect(distribution).toContain("settings.isError");
    expect(distribution).toContain("settings.isLoading");
    expect(management).toContain("hasManagementError");
    expect(management).toContain("reviewReturn.isPending");
  });
});
