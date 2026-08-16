import { describe, expect, it } from "vitest";
import { buildManufacturingDocument } from "./manufacturingOperationalDocuments";

describe("وثائق التصنيع التشغيلية", () => {
  const input = { orderNumber: "PO-42", plannedQuantity: 10, plannedUnit: "قطعة", rawWarehouseId: 2, finishedWarehouseId: 3, bomVersion: "v1", batchNumber: "LOT-7", materials: [{ productId: 9, batchId: 12, requiredQuantity: "10", issuedQuantity: "10", returnedQuantity: "0" }], outputs: [{ batchId: 19, goodQuantity: "9", qualityStatus: "passed" }] };
  it("يبني ملصق دفعة حرارياً جاهزاً للطباعة", () => {
    const document = buildManufacturingDocument("batch_label", "ar", input);
    expect(document.paperSize).toBe("thermal");
    expect(document.rows?.some(row => row.value === "LOT-7")).toBe(true);
  });
  it("يبني تقرير تتبع يربط دفعة المادة بمخرج الإنتاج", () => {
    const document = buildManufacturingDocument("traceability_report", "en", input);
    expect(document.rows?.some(row => row.label.includes("#9"))).toBe(true);
    expect(document.rows?.some(row => row.label.includes("#19"))).toBe(true);
  });
});
