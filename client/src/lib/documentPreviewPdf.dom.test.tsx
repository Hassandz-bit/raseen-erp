import { describe, expect, it, vi } from "vitest";
import { createDocumentPreviewPdf } from "./documentPreviewExport";

const state = vi.hoisted(() => {
  const page = { getWidth: () => 595.28, getHeight: () => 841.89, drawImage: vi.fn() };
  const pdf = { embedPng: vi.fn().mockResolvedValue({ width: 300, height: 200 }), addPage: vi.fn().mockReturnValue(page), save: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])) };
  return { page, pdf, capture: vi.fn().mockResolvedValue({ toDataURL: () => "data:image/png;base64,cGRm" }) };
});

vi.mock("html2canvas", () => ({ default: state.capture }));
vi.mock("pdf-lib", () => ({ PDFDocument: { create: vi.fn().mockResolvedValue(state.pdf) } }));

describe("تنزيل PDF لمعاينة المستند", () => {
  it("ينشئ Blob PDF باسم صحيح ويرسم المعاينة المرئية", async () => {
    const result = await createDocumentPreviewPdf({ direction: "rtl", title: "فاتورة", date: "2026-08-16", documentLabel: "المستند", amount: "١٠٠ د.ج", fontFamily: "noto-arabic", fontSize: "large", paperSize: "A5" }, "nawa-preview.pdf");
    expect(result.filename).toBe("nawa-preview.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(state.capture).toHaveBeenCalledOnce();
    expect(state.pdf.embedPng).toHaveBeenCalledOnce();
    expect(state.pdf.addPage).toHaveBeenCalledWith([419.53, 595.28]);
    expect(state.page.drawImage).toHaveBeenCalledOnce();
  });
});
