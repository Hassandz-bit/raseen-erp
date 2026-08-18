export type SalesInvoiceExportRow = {
  invoiceNumber: string;
  status: string;
  taxMode: "exclusive" | "inclusive";
  currencyCode: string;
  netAmount: number | string;
  taxAmount: number | string;
  grandTotal: number | string;
};

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function buildSalesInvoiceExportCsv(rows: SalesInvoiceExportRow[], labels: { invoice: string; status: string; priceMode: string; netAmount: string; taxAmount: string; grandTotal: string; currency: string }) {
  const header = [labels.invoice, labels.status, labels.priceMode, labels.netAmount, labels.taxAmount, labels.grandTotal, labels.currency];
  const data = rows.map(row => [row.invoiceNumber, row.status, row.taxMode, row.netAmount, row.taxAmount, row.grandTotal, row.currencyCode]);
  return `\ufeff${[header, ...data].map(row => row.map(csvCell).join(",")).join("\n")}`;
}

export function downloadSalesInvoiceExport(rows: SalesInvoiceExportRow[], labels: Parameters<typeof buildSalesInvoiceExportCsv>[1], date = new Date()) {
  const content = buildSalesInvoiceExportCsv(rows, labels);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nawa-sales-invoices-${date.toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
