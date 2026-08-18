export type ProductLabelItem = { id: number; name: string; sku: string; barcode: string };
export type ProductLabelSize = "small" | "medium";

export function isLinearBarcodeCompatible(value: string) {
  return /^[\x20-\x7E]{2,95}$/.test(value);
}

export function escapeLabelText(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function productLabelPrintStyles(size: ProductLabelSize) {
  const dimensions = size === "small" ? { width: "50mm", height: "30mm", columns: 3, name: "11px" } : { width: "70mm", height: "45mm", columns: 2, name: "13px" };
  return `
    @page { margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #16120c; font-family: Arial, 'Noto Sans Arabic', sans-serif; }
    .labels { display: grid; grid-template-columns: repeat(${dimensions.columns}, ${dimensions.width}); gap: 4mm; align-items: start; }
    .label { width: ${dimensions.width}; min-height: ${dimensions.height}; border: .3mm solid #1f1a12; border-radius: 2mm; padding: 2.5mm; display: grid; grid-template-columns: 1fr auto; gap: 2mm; overflow: hidden; page-break-inside: avoid; }
    .identity { min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 1mm; }
    .brand { color: #9a6415; font-weight: 800; font-size: 8px; letter-spacing: .08em; }
    .name { font-size: ${dimensions.name}; font-weight: 800; line-height: 1.25; overflow: hidden; max-height: 2.5em; }
    .sku, .code { font-size: 8px; direction: ltr; text-align: left; word-break: break-all; }
    .barcode { width: 100%; height: 12mm; margin-top: 1mm; }
    .qr { width: 18mm; height: 18mm; align-self: end; }
    .qr img { width: 100%; height: 100%; object-fit: contain; }
    .linear-unavailable { color: #756a58; font-size: 7px; padding-top: 3mm; }
    @media print { .labels { gap: 3mm; } }
  `;
}

export function buildProductLabelDocument(labelsMarkup: string, size: ProductLabelSize, title: string) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeLabelText(title)}</title><style>${productLabelPrintStyles(size)}</style></head><body><main class="labels">${labelsMarkup}</main></body></html>`;
}
