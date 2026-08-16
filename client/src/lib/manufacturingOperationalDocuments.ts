import { buildDocumentPreviewHtml, createDocumentPreviewDownload, createDocumentPreviewPdf, type DocumentPreviewExportData } from "./documentPreviewExport";

export type ManufacturingDocumentType = "production_order" | "material_pick_list" | "material_issue_note" | "material_return_note" | "production_sheet" | "finished_goods_receipt" | "batch_label" | "quality_inspection" | "production_cost_sheet" | "traceability_report";
export type ManufacturingDocumentLanguage = "ar" | "fr" | "en";
export type ManufacturingDocumentInput = { orderNumber: string; plannedQuantity: string | number; plannedUnit: string; rawWarehouseId: number; finishedWarehouseId: number; bomVersion: string; productName?: string; packagingUnit?: string; batchNumber?: string; manufacturingDate?: Date; expiryDate?: Date; qualityStatus?: string; materials?: Array<{ productId: number; batchId?: number | null; requiredQuantity: string; issuedQuantity: string; returnedQuantity: string }>; outputs?: Array<{ batchId?: number | null; goodQuantity: string; qualityStatus: string }>; costs?: Array<{ category: string; amount: string; currencyCode: string }> };

const labels = {
  ar: { production_order: "أمر الإنتاج", material_pick_list: "قائمة تحضير المواد", material_issue_note: "إشعار سحب المواد", material_return_note: "إشعار إرجاع المواد", production_sheet: "ورقة الإنتاج", finished_goods_receipt: "إشعار استلام المنتج النهائي", batch_label: "ملصق الدفعة", quality_inspection: "تقرير فحص الجودة", production_cost_sheet: "ورقة تكلفة الإنتاج", traceability_report: "تقرير تتبّع الدفعات", order: "أمر الإنتاج", product: "المنتج", planned: "الكمية المخططة", bom: "إصدار BOM", rawWarehouse: "مخزن المواد الخام", finishedWarehouse: "مخزن المنتج النهائي", batch: "رقم الدفعة", manufacturingDate: "تاريخ التصنيع", expiryDate: "تاريخ الصلاحية", quality: "حالة الجودة", materials: "المواد", output: "المخرجات", cost: "التكلفة", signature: "التوقيع والمراجعة" },
  fr: { production_order: "Ordre de production", material_pick_list: "Liste de préparation des matières", material_issue_note: "Bon de sortie matières", material_return_note: "Bon de retour matières", production_sheet: "Fiche de production", finished_goods_receipt: "Réception produits finis", batch_label: "Étiquette de lot", quality_inspection: "Rapport de contrôle qualité", production_cost_sheet: "Fiche de coût de production", traceability_report: "Rapport de traçabilité", order: "Ordre", product: "Produit", planned: "Quantité planifiée", bom: "Version de nomenclature", rawWarehouse: "Entrepôt matières", finishedWarehouse: "Entrepôt produits finis", batch: "N° de lot", manufacturingDate: "Date de fabrication", expiryDate: "Date d’expiration", quality: "Statut qualité", materials: "Matières", output: "Résultats", cost: "Coût", signature: "Signature et validation" },
  en: { production_order: "Production order", material_pick_list: "Material pick list", material_issue_note: "Material issue note", material_return_note: "Material return note", production_sheet: "Production sheet", finished_goods_receipt: "Finished-goods receipt", batch_label: "Batch label", quality_inspection: "Quality inspection report", production_cost_sheet: "Production cost sheet", traceability_report: "Batch traceability report", order: "Production order", product: "Product", planned: "Planned quantity", bom: "BOM version", rawWarehouse: "Raw-material warehouse", finishedWarehouse: "Finished-goods warehouse", batch: "Batch number", manufacturingDate: "Manufacturing date", expiryDate: "Expiry date", quality: "Quality status", materials: "Materials", output: "Output", cost: "Cost", signature: "Signature and review" },
} as const;

const formatDate = (value: Date | undefined, language: ManufacturingDocumentLanguage) => value ? value.toLocaleDateString(language === "ar" ? "ar-SA" : language === "fr" ? "fr-FR" : "en-US") : "—";

export function buildManufacturingDocument(type: ManufacturingDocumentType, language: ManufacturingDocumentLanguage, input: ManufacturingDocumentInput): DocumentPreviewExportData {
  const text = labels[language];
  const materialRows = input.materials?.flatMap(item => [{ label: `${text.materials} #${item.productId}${item.batchId ? ` · #${item.batchId}` : ""}`, value: `${item.requiredQuantity} / ${item.issuedQuantity} / ${item.returnedQuantity}` }]) ?? [];
  const outputRows = input.outputs?.flatMap(item => [{ label: `${text.output} #${item.batchId ?? "—"}`, value: `${item.goodQuantity} · ${item.qualityStatus}` }]) ?? [];
  const costRows = input.costs?.map(item => ({ label: `${text.cost} · ${item.category}`, value: `${item.amount} ${item.currencyCode}` })) ?? [];
  const commonRows = [{ label: text.order, value: input.orderNumber }, { label: text.planned, value: `${input.plannedQuantity} ${input.plannedUnit}` }, { label: text.bom, value: input.bomVersion }, { label: text.rawWarehouse, value: `#${input.rawWarehouseId}` }, { label: text.finishedWarehouse, value: `#${input.finishedWarehouseId}` }];
  const batchRows = [{ label: text.product, value: input.productName ?? "—" }, { label: text.batch, value: input.batchNumber ?? "—" }, { label: text.planned, value: `${input.plannedQuantity} ${input.packagingUnit ?? input.plannedUnit}` }, { label: text.manufacturingDate, value: formatDate(input.manufacturingDate, language) }, { label: text.expiryDate, value: formatDate(input.expiryDate, language) }, { label: text.quality, value: input.qualityStatus ?? "—" }];
  const rows = type === "batch_label" ? batchRows : type === "material_pick_list" || type === "material_issue_note" || type === "material_return_note" ? [...commonRows, ...materialRows] : type === "finished_goods_receipt" || type === "quality_inspection" ? [...commonRows, ...batchRows, ...outputRows] : type === "production_cost_sheet" ? [...commonRows, ...costRows] : type === "traceability_report" ? [...commonRows, ...materialRows, ...outputRows] : [...commonRows, ...outputRows];
  return { direction: language === "ar" ? "rtl" : "ltr", title: text[type], date: formatDate(new Date(), language), documentLabel: input.orderNumber, amount: type === "batch_label" ? input.batchNumber ?? "—" : `${input.plannedQuantity} ${input.plannedUnit}`, rows, footer: type === "batch_label" ? "Barcode / QR ready" : text.signature, signatureLabel: type === "batch_label" ? undefined : text.signature, fontFamily: language === "ar" ? "noto-arabic" : "inter", paperSize: type === "batch_label" ? "thermal" : "A4" };
}

export function downloadManufacturingDocumentHtml(data: DocumentPreviewExportData, filename: string) {
  const result = createDocumentPreviewDownload(data, filename);
  const url = URL.createObjectURL(result.blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
}

export async function downloadManufacturingDocumentPdf(data: DocumentPreviewExportData, filename: string) {
  const result = await createDocumentPreviewPdf(data, filename);
  const url = URL.createObjectURL(result.blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
}

export function printManufacturingDocument(data: DocumentPreviewExportData) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return false;
  popup.document.write(buildDocumentPreviewHtml(data)); popup.document.close(); popup.focus(); popup.print();
  return true;
}
