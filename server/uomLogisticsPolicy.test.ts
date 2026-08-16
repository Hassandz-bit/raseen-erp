import { describe, expect, it } from "vitest";
import { assessVehicleCapacity, calculateLogistics, convertFromBaseQuantity, convertToBaseQuantity } from "./uomLogisticsPolicy";

describe("UOM and packaging logistics policy", () => {
  it("يحوّل هرم قارورة وPack وكرتون وبالتة بدقة وفي الاتجاهين", () => {
    expect(convertToBaseQuantity("4", "6")).toBe("24");
    expect(convertToBaseQuantity("10", "24")).toBe("240");
    expect(convertToBaseQuantity("48", "1152")).toBe("55296");
    expect(convertFromBaseQuantity("120", "24")).toBe("5");
  });
  it("يحافظ على الدقة العشرية ولا يستخدم جمعاً عائماً", () => {
    expect(convertToBaseQuantity("0.1", "0.2")).toBe("0.02");
  });
  it("يحسب الوزن والحجم من القيمة الفعلية أو الأبعاد ويبلغ عن النواقص", () => {
    const summary = calculateLogistics([{ label: "Carton", quantity: "10", grossWeightKg: "19.2", actualVolumeM3: "0.048", palletCount: "0.020833333" }, { label: "Missing", quantity: "1" }]);
    expect(summary.totalGrossWeightKg).toBe("192");
    expect(summary.totalVolumeM3).toBe("0.48");
    expect(summary.missing).toEqual(["Missing"]);
  });
  it("يرفض المركبة التي توافق الوزن لكن تفشل في الحجم أو البالتة", () => {
    const summary = calculateLogistics([{ label: "Carton", quantity: "10", grossWeightKg: "10", actualVolumeM3: "2", palletCount: "1" }]);
    const assessment = assessVehicleCapacity(summary, { maximumPayloadWeight: "200", maximumVolume: "10", palletCapacity: "8" });
    expect(assessment.suitable).toBe(false);
    expect(assessment.reasons).toContain("volume_exceeded");
    expect(assessment.reasons).toContain("pallet_capacity_exceeded");
  });
});
