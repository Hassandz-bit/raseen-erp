export type WorkspaceReportRow = { label: string; value: string };

export function buildWorkspaceReportExcel(title: string, generatedAt: string, rows: WorkspaceReportRow[]) {
  const safe = (value: string) => value.replace(/[\t\r\n]/g, " ");
  return [safe(title), `Generated at\t${safe(generatedAt)}`, "Metric\tValue", ...rows.map(row => `${safe(row.label)}\t${safe(row.value)}`)].join("\n");
}
