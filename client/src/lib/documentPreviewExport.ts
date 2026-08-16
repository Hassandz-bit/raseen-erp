export type DocumentPreviewExportData = {
  direction: "rtl" | "ltr";
  title: string;
  date: string;
  documentLabel: string;
  amount: string;
  footer?: string;
  signatureLabel?: string;
  fontFamily?: "ibm-plex" | "tajawal" | "noto-arabic" | "inter" | "system";
  fontSize?: "small" | "normal" | "large";
};

const resolveDocumentFont = (fontFamily: DocumentPreviewExportData["fontFamily"]) => ({ "ibm-plex": "IBM Plex Sans", tajawal: "Tajawal", "noto-arabic": "Noto Arabic", inter: "Inter", system: "Arial" }[fontFamily ?? "noto-arabic"]);

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export function buildDocumentPreviewHtml(data: DocumentPreviewExportData) {
  const signature = data.signatureLabel ? `<div class="signature">${escapeHtml(data.signatureLabel)}</div>` : "";
  const fontSize = data.fontSize === "small" ? "14px" : data.fontSize === "large" ? "18px" : "16px";
  const fontFamily = resolveDocumentFont(data.fontFamily);
  return `<!doctype html><html dir="${data.direction}"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>body{font-family:${fontFamily},sans-serif;font-size:${fontSize};color:#172033;padding:32px}article{max-width:680px;margin:auto;border:1px solid #d7dce5;border-radius:16px;padding:28px}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #d7dce5;border-bottom:1px solid #d7dce5;margin:24px 0;padding:16px 0}.amount{font-size:24px;font-weight:700}.signature{border-top:1px solid #94a3b8;margin-top:42px;padding-top:8px;font-size:12px}@media print{body{padding:0}article{border:0}}</style></head><body><article><h1>${escapeHtml(data.title)}</h1><p class="muted">${escapeHtml(data.date)}</p><div class="line"><p>${escapeHtml(data.documentLabel)}</p><p class="amount">${escapeHtml(data.amount)}</p></div><p class="muted">${escapeHtml(data.footer ?? "")}</p>${signature}</article></body></html>`;
}

export function createDocumentPreviewDownload(data: DocumentPreviewExportData, filename: string) {
  const blob = new Blob([buildDocumentPreviewHtml(data)], { type: "text/html;charset=utf-8" });
  return { blob, filename: filename.endsWith(".html") ? filename : `${filename}.html` };
}

export function buildDocumentPreviewFilename(language: string, date: Date) {
  return `nawa-${language}-${date.toISOString().slice(0, 10)}.html`;
}

export function buildDocumentPreviewPdfFilename(language: string, date: Date) {
  return buildDocumentPreviewFilename(language, date).replace(/\.html$/, ".pdf");
}

export async function createDocumentPreviewPdf(data: DocumentPreviewExportData, filename: string) {
  if (typeof document === "undefined") throw new Error("Document preview PDF requires a browser environment.");
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([import("html2canvas"), import("pdf-lib")]);
  const host = document.createElement("div");
  host.dir = data.direction;
  const fontSize = data.fontSize === "small" ? "14px" : data.fontSize === "large" ? "18px" : "16px";
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:720px;padding:32px;background:#fff;color:#172033;font-family:${resolveDocumentFont(data.fontFamily)},sans-serif;font-size:${fontSize};z-index:-1;`;
  host.innerHTML = `<article style="border:1px solid #d7dce5;border-radius:16px;padding:28px"><h1 style="margin:0;font-size:28px">${escapeHtml(data.title)}</h1><p style="color:#64748b;font-size:12px">${escapeHtml(data.date)}</p><div style="border-top:1px solid #d7dce5;border-bottom:1px solid #d7dce5;margin:24px 0;padding:16px 0"><p>${escapeHtml(data.documentLabel)}</p><p style="font-size:24px;font-weight:700">${escapeHtml(data.amount)}</p></div><p style="color:#64748b;font-size:12px">${escapeHtml(data.footer ?? "")}</p>${data.signatureLabel ? `<div style="border-top:1px solid #94a3b8;margin-top:42px;padding-top:8px;font-size:12px">${escapeHtml(data.signatureLabel)}</div>` : ""}</article>`;
  document.body.append(host);
  try {
    await document.fonts?.ready;
    const canvas = await html2canvas(host, { backgroundColor: "#ffffff", scale: 2, logging: false });
    const pdf = await PDFDocument.create();
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    const page = pdf.addPage([595.28, 841.89]);
    const maxWidth = page.getWidth() - 64;
    const maxHeight = page.getHeight() - 64;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    page.drawImage(image, { x: (page.getWidth() - image.width * scale) / 2, y: page.getHeight() - 32 - image.height * scale, width: image.width * scale, height: image.height * scale });
    const bytes = await pdf.save();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return { blob: new Blob([buffer], { type: "application/pdf" }), filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf` };
  } finally {
    host.remove();
  }
}
