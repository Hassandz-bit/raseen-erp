import { buildAdaptiveExcelHtml } from "./adaptiveTableExport";

export type WorkspaceReportRow = { label: string; value: string };

export function buildWorkspaceReportExcel(title: string, generatedAt: string, rows: WorkspaceReportRow[]) {
  return buildAdaptiveExcelHtml({ title, generatedAt: `Generated at: ${generatedAt}`, headers: ["Metric", "Value"], rows: rows.map(row => [row.label, row.value]) });
}
