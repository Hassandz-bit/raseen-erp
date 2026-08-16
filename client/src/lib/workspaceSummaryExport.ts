export type WorkspaceSummaryExportLabels = { metric: string; value: string; revenue: string; expenses: string; netProfit: string; issuedInvoices: string; products: string };
export type WorkspaceSummaryExportValues = { totalIncome: number; totalExpenses: number; netProfit: number; issuedInvoices: number; products: number };
export type WorkspaceSummaryExportFormatters = { formatCurrency: (value: number) => string; formatNumber: (value: number) => string };

const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export function buildWorkspaceSummaryCsv(labels: WorkspaceSummaryExportLabels, values: WorkspaceSummaryExportValues, formatters: WorkspaceSummaryExportFormatters = { formatCurrency: value => String(value), formatNumber: value => String(value) }) {
  return [
    `${escapeCsv(labels.metric)},${escapeCsv(labels.value)}`,
    `${escapeCsv(labels.revenue)},${escapeCsv(formatters.formatCurrency(values.totalIncome))}`,
    `${escapeCsv(labels.expenses)},${escapeCsv(formatters.formatCurrency(values.totalExpenses))}`,
    `${escapeCsv(labels.netProfit)},${escapeCsv(formatters.formatCurrency(values.netProfit))}`,
    `${escapeCsv(labels.issuedInvoices)},${escapeCsv(formatters.formatNumber(values.issuedInvoices))}`,
    `${escapeCsv(labels.products)},${escapeCsv(formatters.formatNumber(values.products))}`,
  ].join("\n");
}
