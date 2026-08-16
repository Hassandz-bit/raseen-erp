import { describe, expect, it } from "vitest";
import { buildWorkspaceSummaryCsv } from "./workspaceSummaryExport";

describe("تصدير ملخص مساحة العمل", () => {
  it("يعتمد عناوين القاموس وتنسيقات المؤسسة بدلاً من نصوص وقيم خامة", () => {
    const csv = buildWorkspaceSummaryCsv({ metric: "Indicateur", value: "Valeur", revenue: "Revenus", expenses: "Dépenses", netProfit: "Bénéfice", issuedInvoices: "Factures", products: "Produits" }, { totalIncome: 10, totalExpenses: 3, netProfit: 7, issuedInvoices: 2, products: 4 }, { formatCurrency: value => `${value},00 DZD`, formatNumber: value => `#${value}` });
    expect(csv).toContain('"Indicateur","Valeur"');
    expect(csv).toContain('"Revenus","10,00 DZD"');
    expect(csv).toContain('"Factures","#2"');
  });
});
