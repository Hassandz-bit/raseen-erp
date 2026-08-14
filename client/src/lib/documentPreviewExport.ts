export type DocumentPreviewExportData = {
  direction: "rtl" | "ltr";
  title: string;
  date: string;
  documentLabel: string;
  amount: string;
  footer?: string;
  signatureLabel?: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export function buildDocumentPreviewHtml(data: DocumentPreviewExportData) {
  const signature = data.signatureLabel ? `<div class="signature">${escapeHtml(data.signatureLabel)}</div>` : "";
  return `<!doctype html><html dir="${data.direction}"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}article{max-width:680px;margin:auto;border:1px solid #d7dce5;border-radius:16px;padding:28px}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #d7dce5;border-bottom:1px solid #d7dce5;margin:24px 0;padding:16px 0}.amount{font-size:24px;font-weight:700}.signature{border-top:1px solid #94a3b8;margin-top:42px;padding-top:8px;font-size:12px}@media print{body{padding:0}article{border:0}}</style></head><body><article><h1>${escapeHtml(data.title)}</h1><p class="muted">${escapeHtml(data.date)}</p><div class="line"><p>${escapeHtml(data.documentLabel)}</p><p class="amount">${escapeHtml(data.amount)}</p></div><p class="muted">${escapeHtml(data.footer ?? "")}</p>${signature}</article></body></html>`;
}
