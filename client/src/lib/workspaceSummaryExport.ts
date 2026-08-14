export type WorkspaceSummaryExportLabels = { metric: string; value: string; revenue: string; expenses: string; netProfit: string; issuedInvoices: string; products: string };
export type WorkspaceSummaryExportValues = { totalIncome: number; totalExpenses: number; netProfit: number; issuedInvoices: number; products: number };

export function buildWorkspaceSummaryCsv(labels: WorkspaceSummaryExportLabels, values: WorkspaceSummaryExportValues) {
  return [
    `${labels.metric},${labels.value}`,
    `${labels.revenue},${values.totalIncome}`,
    `${labels.expenses},${values.totalExpenses}`,
    `${labels.netProfit},${values.netProfit}`,
    `${labels.issuedInvoices},${values.issuedInvoices}`,
    `${labels.products},${values.products}`,
  ].join("\n");
}
