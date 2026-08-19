import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildAdaptiveExcelHtml } from "./adaptiveTableExport";

export type ExchangeRateExportRow = { baseCurrencyCode: string; quoteCurrencyCode: string; rate: string | number; effectiveAt: Date | string; source: string };
export type ExchangeRateExportOptions = { formatRate?: (value: number) => string; formatDate?: (value: Date | string) => string };

export function buildExchangeRateExcel(rows: ExchangeRateExportRow[], options: ExchangeRateExportOptions = {}) {
  const formatRate = options.formatRate ?? (value => String(value));
  const formatDate = options.formatDate ?? (value => new Date(value).toISOString());
  return buildAdaptiveExcelHtml({ title: "RASEEN ERP — Exchange rate history", headers: ["Base", "Quote", "Rate", "Effective date", "Source"], rows: rows.map(row => [row.baseCurrencyCode, row.quoteCurrencyCode, formatRate(Number(row.rate)), formatDate(row.effectiveAt), row.source]), direction: "ltr" });
}

export async function buildExchangeRatePdf(rows: ExchangeRateExportRow[], options: ExchangeRateExportOptions = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const formatRate = options.formatRate ?? (value => String(value));
  const formatDate = options.formatDate ?? (value => new Date(value).toISOString().slice(0, 10));
  rows.forEach((row, index) => {
    const position = index % 25;
    const pageIndex = Math.floor(index / 25);
    if (position === 0) {
      const page = pdf.addPage([842, 595]);
      page.drawText("RASEEN ERP — Exchange rate history", { x: 42, y: 550, size: 18, font: bold, color: rgb(.12, .16, .22) });
      page.drawText(`Page ${pageIndex + 1}`, { x: 755, y: 550, size: 9, font });
      [["Base", 42], ["Quote", 100], ["Rate", 162], ["Effective date", 255], ["Source", 415]].forEach(([label, x]) => page.drawText(String(label), { x: Number(x), y: 520, size: 10, font: bold }));
    }
    const clip = (value: string, size: number) => value.length > size ? `${value.slice(0, Math.max(1, size - 1))}…` : value;
    const values: Array<[string, number, number]> = [[clip(row.baseCurrencyCode, 8), 42, 52], [clip(row.quoteCurrencyCode, 8), 100, 56], [clip(formatRate(Number(row.rate)), 14), 162, 80], [clip(formatDate(row.effectiveAt), 22), 255, 150], [clip(row.source, 42), 415, 380]];
    values.forEach(([value, x]) => pdf.getPages()[pageIndex].drawText(value, { x, y: 500 - position * 17, size: 9, font }));
  });
  return pdf.save();
}
