import { RASEEN_PRINT_LOGO_URL } from "@/config/raseenBrandAssets";

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

const fonts = { "ibm-plex": "IBM Plex Sans", tajawal: "Tajawal", "noto-arabic": "Noto Arabic", inter: "Inter", system: "Arial" } as const;
const paperProfiles: Record<NonNullable<DocumentPreviewExportData["paperSize"]>, { cssWidth: string; cssHeight: string; hostWidth: string; pdfPage: [number, number] }> = {
  A4: { cssWidth: "210mm", cssHeight: "297mm", hostWidth: "794px", pdfPage: [595.28, 841.89] },
  A5: { cssWidth: "148mm", cssHeight: "210mm", hostWidth: "559px", pdfPage: [419.53, 595.28] },
  thermal: { cssWidth: "80mm", cssHeight: "auto", hostWidth: "302px", pdfPage: [226.77, 841.89] },
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
const trustedLogo = (value?: string) => value?.startsWith("/manus-storage/") ? value : undefined;
const trustedQrDataUrl = (value?: string) => value && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;
const fontFor = (value: DocumentPreviewExportData["fontFamily"]) => fonts[value ?? "noto-arabic"];
const paperFor = (value: DocumentPreviewExportData["paperSize"]) => paperProfiles[value ?? "A4"];

function renderRows(rows: DocumentPreviewExportData["rows"], compact = false) {
  if (!rows?.length) return "";
  const style = compact ? "padding:6px 10px;line-height:1.3;" : "";
  return `<div class="rows">${rows.map((row, index) => `<div class="row" style="${style}${index ? "border-top:1px solid #e2e8f0;" : ""}"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`).join("")}</div>`;
}

function organizationLogo(data: DocumentPreviewExportData, minimal = false) {
  const logo = trustedLogo(data.logoUrl);
  return logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="">` : "";
}

function documentBody(data: DocumentPreviewExportData, inline = false) {
  const fontSize = data.fontSize === "small" ? "14px" : data.fontSize === "large" ? "18px" : "16px";
  const paper = paperFor(data.paperSize);
  const isMinimal = data.headerTemplate === "minimal";
  const brandLogo = `<img class="brand-logo${isMinimal ? " minimal" : ""}" src="${RASEEN_PRINT_LOGO_URL}" alt="RASEEN ERP">`;
  const logo = organizationLogo(data, isMinimal);
  const legal = [data.taxNumber ? `${data.direction === "rtl" ? "الرقم الضريبي" : "Tax ID"}: ${data.taxNumber}` : "", data.legalInfo ?? ""].filter(Boolean).map(escapeHtml).join("<br>");
  const watermark = data.useLogoWatermark && trustedLogo(data.logoUrl) ? `<img class="watermark" src="${escapeHtml(trustedLogo(data.logoUrl)!)}" alt="">` : "";
  const verification = trustedQrDataUrl(data.verificationQrDataUrl) ? `<div class="verification"><img src="${escapeHtml(trustedQrDataUrl(data.verificationQrDataUrl)!)}" alt=""><span>${escapeHtml(data.verificationLabel ?? "Verify invoice")}</span></div>` : "";
  const seal = data.showElectronicSeal ? `<div class="seal">✓ <span>${escapeHtml(data.electronicSealLabel ?? "Electronic organization seal")}</span></div>` : "";
  const signature = data.signatureLabel ? `<div class="signature">${escapeHtml(data.signatureLabel)}</div>` : "";
  const headerStyle = ` template-${data.headerTemplate ?? "classic"}`;
  const articleStyle = inline ? `width:${paper.hostWidth};padding:28px;` : `width:${paper.cssWidth};min-height:${paper.cssHeight};padding:28px;`;
  return `<article style="${articleStyle}">${watermark}<div class="document-content"><div class="header${headerStyle}"><div class="branding">${brandLogo}${logo}</div><div class="legal">${legal}</div></div><h1>${escapeHtml(data.title)}</h1><p class="muted">${escapeHtml(data.date)}</p><div class="line"><p>${escapeHtml(data.documentLabel)}</p><p class="amount">${escapeHtml(data.amount)}</p></div>${renderRows(data.rows, inline)}${verification}<p class="muted">${escapeHtml(data.footer ?? "")}</p>${seal}${signature}</div></article>`;
}

const documentCss = (data: DocumentPreviewExportData) => `
  body{font-family:${fontFor(data.fontFamily)},sans-serif;font-size:${data.fontSize === "small" ? "14px" : data.fontSize === "large" ? "18px" : "16px"};color:#172033;padding:32px;background:#fff}
  article{position:relative;isolation:isolate;box-sizing:border-box;margin:auto;border:1px solid #d7dce5;border-radius:16px;overflow:hidden;background:#fff}.document-content{position:relative;z-index:1}.header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}.header.template-split{border-bottom:2px solid #d7b56d;padding-bottom:14px}.branding{display:flex;align-items:center;gap:10px}.brand-logo{display:block;max-width:76px;max-height:64px;object-fit:contain}.brand-logo.minimal{max-width:58px;max-height:46px}.logo{display:block;max-width:118px;max-height:64px;object-fit:contain}.header.template-split .logo{max-width:110px}.legal{max-width:55%;color:#475569;font-size:11px;line-height:1.7;text-align:start}.watermark{position:absolute;inset:18% 12%;width:76%;height:64%;object-fit:contain;opacity:.055;filter:grayscale(1);z-index:0;pointer-events:none}.verification{display:flex;align-items:center;gap:10px;margin-top:22px;color:#475569;font-size:11px}.verification img{width:68px;height:68px}.seal{margin-top:28px;display:inline-flex;align-items:center;gap:8px;border:1px solid #b48b2a;border-radius:999px;padding:7px 12px;color:#7b5b12;font-size:11px;font-weight:700}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #d7dce5;border-bottom:1px solid #d7dce5;margin:24px 0;padding:16px 0}.amount{font-size:24px;font-weight:700}.rows{margin-top:16px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.row{display:grid;grid-template-columns:minmax(7rem,auto) minmax(0,1fr);align-items:center;gap:10px;padding:6px 10px;line-height:1.3}.row span,.row strong{min-width:0;overflow-wrap:anywhere}.row strong{text-align:end}.signature{border-top:1px solid #94a3b8;margin-top:42px;padding-top:8px;font-size:12px}
`;

export function buildDocumentPreviewHtml(data: DocumentPreviewExportData) {
  return `<!doctype html><html dir="${data.direction}"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>${documentCss(data)}@media print{body{padding:0}article{border:0}.row{padding:4px 7px;gap:7px;line-height:1.2}}</style></head><body>${documentBody(data)}</body></html>`;
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
  const paper = paperFor(data.paperSize);
  const host = document.createElement("div");
  host.dir = data.direction;
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${paper.hostWidth};padding:32px;background:#fff;color:#172033;z-index:-1;`;
  host.innerHTML = `<style>${documentCss(data)}body{padding:0}article{border-radius:16px}</style>${documentBody(data, true)}`;
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
