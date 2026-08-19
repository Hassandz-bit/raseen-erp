export type DocumentPreviewExportData = {
  direction: "rtl" | "ltr";
  logoUrl?: string;
  taxNumber?: string;
  legalInfo?: string;
  useLogoWatermark?: boolean;
  verificationQrDataUrl?: string;
  verificationLabel?: string;
  headerTemplate?: "classic" | "split" | "minimal";
  showElectronicSeal?: boolean;
  electronicSealLabel?: string;
  title: string;
  date: string;
  documentLabel: string;
  amount: string;
  footer?: string;
  signatureLabel?: string;
  rows?: { label: string; value: string }[];
  fontFamily?: "ibm-plex" | "tajawal" | "noto-arabic" | "inter" | "system";
  fontSize?: "small" | "normal" | "large";
  paperSize?: "A4" | "A5" | "thermal";
};

const resolveDocumentFont = (fontFamily: DocumentPreviewExportData["fontFamily"]) => ({ "ibm-plex": "IBM Plex Sans", tajawal: "Tajawal", "noto-arabic": "Noto Arabic", inter: "Inter", system: "Arial" }[fontFamily ?? "noto-arabic"]);
const paperProfiles: Record<NonNullable<DocumentPreviewExportData["paperSize"]>, { cssWidth: string; cssHeight: string; hostWidth: string; pdfPage: [number, number] }> = { A4: { cssWidth: "210mm", cssHeight: "297mm", hostWidth: "794px", pdfPage: [595.28, 841.89] }, A5: { cssWidth: "148mm", cssHeight: "210mm", hostWidth: "559px", pdfPage: [419.53, 595.28] }, thermal: { cssWidth: "80mm", cssHeight: "auto", hostWidth: "302px", pdfPage: [226.77, 841.89] } };
const resolvePaperProfile = (paperSize: DocumentPreviewExportData["paperSize"]) => paperProfiles[paperSize ?? "A4"];
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
const trustedLogo = (value?: string) => value?.startsWith("/manus-storage/") ? value : undefined;
const trustedQrDataUrl = (value?: string) => value && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;

function renderRows(rows: DocumentPreviewExportData["rows"], inline = false) {
  if (!rows?.length) return "";
  const rowStyle = inline ? "display:grid;grid-template-columns:minmax(7rem,auto) minmax(0,1fr);align-items:center;gap:8px;padding:6px 10px;line-height:1.3;" : "";
  const cellStyle = inline ? "min-width:0;overflow-wrap:anywhere;" : "";
  return `<div class="rows"${inline ? ' style="margin-top:16px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden"' : ""}>${rows.map((row, index) => `<div class="row" style="${rowStyle}${inline && index ? "border-top:1px solid #e2e8f0;" : ""}"><span style="${cellStyle}">${escapeHtml(row.label)}</span><strong style="${cellStyle}text-align:end">${escapeHtml(row.value)}</strong></div>`).join("")}</div>`;
}

export function buildDocumentPreviewHtml(data: DocumentPreviewExportData) {
  const signature = data.signatureLabel ? `<div class="signature">${escapeHtml(data.signatureLabel)}</div>` : "";
  const rows = renderRows(data.rows);
  const fontSize = data.fontSize === "small" ? "14px" : data.fontSize === "large" ? "18px" : "16px";
  const fontFamily = resolveDocumentFont(data.fontFamily);
  const paper = resolvePaperProfile(data.paperSize);
  const logo = trustedLogo(data.logoUrl) ? `<img class="logo" src="${escapeHtml(trustedLogo(data.logoUrl)!)}" alt="">` : "";
  const legal = [data.taxNumber ? `${data.direction === "rtl" ? "الرقم الضريبي" : "Tax ID"}: ${data.taxNumber}` : "", data.legalInfo ?? ""].filter(Boolean).map(escapeHtml).join("<br>");
  const watermark = data.useLogoWatermark && trustedLogo(data.logoUrl) ? `<img class="watermark" src="${escapeHtml(trustedLogo(data.logoUrl)!)}" alt="">` : "";
  const verification = trustedQrDataUrl(data.verificationQrDataUrl) ? `<div class="verification"><img src="${escapeHtml(trustedQrDataUrl(data.verificationQrDataUrl)!)}" alt=""><span>${escapeHtml(data.verificationLabel ?? "Verify invoice")}</span></div>` : "";
  const seal = data.showElectronicSeal ? `<div class="seal">✓<span>${escapeHtml(data.electronicSealLabel ?? "Electronic organization seal")}</span></div>` : "";
  return `<!doctype html><html dir="${data.direction}"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>body{font-family:${fontFamily},sans-serif;font-size:${fontSize};color:#172033;padding:32px}article{position:relative;isolation:isolate;width:${paper.cssWidth};min-height:${paper.cssHeight};box-sizing:border-box;margin:auto;border:1px solid #d7dce5;border-radius:16px;padding:28px;overflow:hidden}.document-content{position:relative;z-index:1}.header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}.header.template-split{border-bottom:2px solid #d7b56d;padding-bottom:14px}.header.template-minimal .logo{max-width:110px;max-height:46px}.logo{display:block;max-width:160px;max-height:64px;object-fit:contain}.legal{max-width:55%;color:#475569;font-size:11px;line-height:1.7;text-align:start}.watermark{position:absolute;inset:18% 12%;width:76%;height:64%;object-fit:contain;opacity:.055;filter:grayscale(1);z-index:0;pointer-events:none}.verification{display:flex;align-items:center;gap:10px;margin-top:22px;color:#475569;font-size:11px}.verification img{width:68px;height:68px}.seal{margin-top:28px;display:inline-flex;align-items:center;gap:8px;border:1px solid #b48b2a;border-radius:999px;padding:7px 12px;color:#7b5b12;font-size:11px;font-weight:700}.seal:first-letter{font-size:16px}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #d7dce5;border-bottom:1px solid #d7dce5;margin:24px 0;padding:16px 0}.amount{font-size:24px;font-weight:700}.rows{margin-top:16px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.row{display:grid;grid-template-columns:minmax(7rem,auto) minmax(0,1fr);align-items:center;gap:10px;padding:6px 10px;border-top:1px solid #e2e8f0;line-height:1.3}.row span,.row strong{min-width:0;overflow-wrap:anywhere}.row strong{text-align:end}.row:first-child{border-top:0}.signature{border-top:1px solid #94a3b8;margin-top:42px;padding-top:8px;font-size:12px}@media print{body{padding:0}article{border:0}.row{padding:4px 7px;gap:7px;line-height:1.2}}</style></head><body><article>${watermark}<div class="document-content"><div class="header template-${escapeHtml(data.headerTemplate ?? "classic")}">${logo}<div class="legal">${legal}</div></div><h1>${escapeHtml(data.title)}</h1><p class="muted">${escapeHtml(data.date)}</p><div class="line"><p>${escapeHtml(data.documentLabel)}</p><p class="amount">${escapeHtml(data.amount)}</p></div>${rows}${verification}<p class="muted">${escapeHtml(data.footer ?? "")}</p>${seal}${signature}</div></article></body></html>`;
}

export function createDocumentPreviewDownload(data: DocumentPreviewExportData, filename: string) {
  const blob = new Blob([buildDocumentPreviewHtml(data)], { type: "text/html;charset=utf-8" });
  return { blob, filename: filename.endsWith(".html") ? filename : `${filename}.html` };
}
export function buildDocumentPreviewFilename(language: string, date: Date) { return `nawa-${language}-${date.toISOString().slice(0, 10)}.html`; }
export function buildDocumentPreviewPdfFilename(language: string, date: Date) { return buildDocumentPreviewFilename(language, date).replace(/\.html$/, ".pdf"); }

export async function createDocumentPreviewPdf(data: DocumentPreviewExportData, filename: string) {
  if (typeof document === "undefined") throw new Error("Document preview PDF requires a browser environment.");
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([import("html2canvas"), import("pdf-lib")]);
  const host = document.createElement("div");
  host.dir = data.direction;
  const fontSize = data.fontSize === "small" ? "14px" : data.fontSize === "large" ? "18px" : "16px";
  const paper = resolvePaperProfile(data.paperSize);
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${paper.hostWidth};padding:32px;background:#fff;color:#172033;font-family:${resolveDocumentFont(data.fontFamily)},sans-serif;font-size:${fontSize};z-index:-1;`;
  const rows = renderRows(data.rows, true);
  const logo = trustedLogo(data.logoUrl) ? `<img src="${escapeHtml(trustedLogo(data.logoUrl)!)}" alt="" style="display:block;max-width:160px;max-height:64px;object-fit:contain">` : "";
  const legal = [data.taxNumber ? `${data.direction === "rtl" ? "الرقم الضريبي" : "Tax ID"}: ${data.taxNumber}` : "", data.legalInfo ?? ""].filter(Boolean).map(escapeHtml).join("<br>");
  const watermark = data.useLogoWatermark && trustedLogo(data.logoUrl) ? `<img src="${escapeHtml(trustedLogo(data.logoUrl)!)}" alt="" style="position:absolute;inset:18% 12%;width:76%;height:64%;object-fit:contain;opacity:.055;filter:grayscale(1);pointer-events:none">` : "";
  const headerStyle = data.headerTemplate === "split" ? "border-bottom:2px solid #d7b56d;padding-bottom:14px;" : "";
  const renderedLogo = data.headerTemplate === "minimal" && logo ? logo.replace("max-width:160px;max-height:64px", "max-width:110px;max-height:46px") : logo;
  const verification = trustedQrDataUrl(data.verificationQrDataUrl) ? `<div style="display:flex;align-items:center;gap:10px;margin-top:22px;color:#475569;font-size:11px"><img src="${escapeHtml(trustedQrDataUrl(data.verificationQrDataUrl)!)}" alt="" style="width:68px;height:68px"><span>${escapeHtml(data.verificationLabel ?? "Verify invoice")}</span></div>` : "";
  const seal = data.showElectronicSeal ? `<div style="margin-top:28px;display:inline-flex;align-items:center;gap:8px;border:1px solid #b48b2a;border-radius:999px;padding:7px 12px;color:#7b5b12;font-size:11px;font-weight:700">✓ <span>${escapeHtml(data.electronicSealLabel ?? "Electronic organization seal")}</span></div>` : "";
  host.innerHTML = `<article style="position:relative;overflow:hidden;border:1px solid #d7dce5;border-radius:16px;padding:28px">${watermark}<div style="position:relative;z-index:1"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px;${headerStyle}">${renderedLogo}<div style="max-width:55%;color:#475569;font-size:11px;line-height:1.7">${legal}</div></div><h1 style="margin:0;font-size:28px">${escapeHtml(data.title)}</h1><p style="color:#64748b;font-size:12px">${escapeHtml(data.date)}</p><div style="border-top:1px solid #d7dce5;border-bottom:1px solid #d7dce5;margin:24px 0;padding:16px 0"><p>${escapeHtml(data.documentLabel)}</p><p style="font-size:24px;font-weight:700">${escapeHtml(data.amount)}</p></div>${rows}${verification}<p style="color:#64748b;font-size:12px">${escapeHtml(data.footer ?? "")}</p>${seal}${data.signatureLabel ? `<div style="border-top:1px solid #94a3b8;margin-top:42px;padding-top:8px;font-size:12px">${escapeHtml(data.signatureLabel)}</div>` : ""}</div></article>`;
  document.body.append(host);
  try {
    await document.fonts?.ready;
    await Promise.all(Array.from(host.querySelectorAll("img")).filter(image => !image.complete).map(image => new Promise<void>(resolve => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); window.setTimeout(resolve, 1200); })));
    const canvas = await html2canvas(host, { backgroundColor: "#ffffff", scale: 2, logging: false });
    const pdf = await PDFDocument.create();
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    const page = pdf.addPage(paper.pdfPage);
    const maxWidth = page.getWidth() - 64;
    const maxHeight = page.getHeight() - 64;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    page.drawImage(image, { x: (page.getWidth() - image.width * scale) / 2, y: page.getHeight() - 32 - image.height * scale, width: image.width * scale, height: image.height * scale });
    const bytes = await pdf.save();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return { blob: new Blob([buffer], { type: "application/pdf" }), filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf` };
  } finally { host.remove(); }
}
