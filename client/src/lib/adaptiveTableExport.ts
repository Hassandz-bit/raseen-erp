type AdaptiveTableExport = { title: string; generatedAt?: string; headers: string[]; rows: Array<Array<string | number>>; direction?: "rtl" | "ltr" };

const clean = (value: string | number) => String(value).replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
const escapeHtml = (value: string | number) => clean(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
const visualLength = (value: string | number) => Array.from(clean(value)).length;

export function buildAdaptiveExcelHtml({ title, generatedAt, headers, rows, direction = "rtl" }: AdaptiveTableExport) {
  const widths = headers.map((header, column) => Math.max(12, Math.min(46, Math.ceil(Math.max(visualLength(header), ...rows.map(row => visualLength(row[column] ?? ""))) * 1.08) + 2)));
  const titleRow = `<tr class="title"><td colspan="${headers.length}">${escapeHtml(title)}</td></tr>`;
  const generatedRow = generatedAt ? `<tr class="meta"><td colspan="${headers.length}">${escapeHtml(generatedAt)}</td></tr>` : "";
  return `<!doctype html><html dir="${direction}"><head><meta charset="utf-8"><style>table{border-collapse:collapse;table-layout:auto}th,td{border:1px solid #cbd5e1;padding:5px 8px;vertical-align:middle;white-space:normal;word-break:break-word;line-height:1.3}th{background:#f1f5f9;color:#172033;font-weight:700}.title td{border:0;padding:3px 0 7px;font-size:15pt;font-weight:700}.meta td{border:0;padding:0 0 8px;color:#475569;font-size:9pt}</style></head><body><table><colgroup>${widths.map(width => `<col style="width:${width}ch">`).join("")}</colgroup><tbody>${titleRow}${generatedRow}<tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr>${rows.map(row => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}
