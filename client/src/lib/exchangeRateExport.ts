import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExchangeRateExportRow = { baseCurrencyCode: string; quoteCurrencyCode: string; rate: string | number; effectiveAt: Date | string; source: string };
export type ExchangeRateExportOptions = { formatRate?: (value: number) => string; formatDate?: (value: Date | string) => string };

export function buildExchangeRateExcel(rows: ExchangeRateExportRow[], options: ExchangeRateExportOptions = {}) {
  const header = "Base\tQuote\tRate\tEffective date\tSource";
  const formatRate = options.formatRate ?? (value => String(value));
  const formatDate = options.formatDate ?? (value => new Date(value).toISOString());
  return [header, ...rows.map(row => `${row.baseCurrencyCode}\t${row.quoteCurrencyCode}\t${formatRate(Number(row.rate))}\t${formatDate(row.effectiveAt)}\t${row.source}`)].join("\n");
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
      page.drawText("Base     Quote     Rate                 Effective date             Source", { x: 42, y: 520, size: 10, font: bold });
    }
    pdf.getPages()[pageIndex].drawText(`${row.baseCurrencyCode.padEnd(9)}${row.quoteCurrencyCode.padEnd(10)}${formatRate(Number(row.rate)).padEnd(21)}${formatDate(row.effectiveAt).padEnd(27)}${row.source}`, { x: 42, y: 500 - position * 17, size: 9, font });
  });
  return pdf.save();
}
