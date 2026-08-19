import { createDocumentPreviewPdf, type DocumentPreviewExportData } from "./documentPreviewExport";
import { buildAdaptiveExcelHtml } from "./adaptiveTableExport";

export type DistributionReportRow = { label: string; value: string };

export function buildDistributionExcel(title: string, generatedAt: string, rows: DistributionReportRow[]) {
  return buildAdaptiveExcelHtml({ title, generatedAt, headers: ["Metric", "Value"], rows: rows.map(row => [row.label, row.value]) });
}

export function downloadDistributionExcel(title: string, generatedAt: string, rows: DistributionReportRow[], filename: string) {
  const blob = new Blob(["\ufeff", buildDistributionExcel(title, generatedAt, rows)], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadDistributionPdf(data: DocumentPreviewExportData, filename: string) {
  const result = await createDocumentPreviewPdf(data, filename);
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
