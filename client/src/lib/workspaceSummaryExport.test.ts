import { describe, expect, it } from "vitest";
import { buildWorkspaceSummaryCsv } from "./workspaceSummaryExport";

describe("تصدير ملخص مساحة العمل", () => {
  it("يعتمد عناوين القاموس المقدمة بدلاً من نصوص ثابتة", () => {
    const csv = buildWorkspaceSummaryCsv({ metric: "Indicateur", value: "Valeur", revenue: "Revenus", expenses: "Dépenses", netProfit: "Bénéfice", issuedInvoices: "Factures", products: "Produits" }, { totalIncome: 10, totalExpenses: 3, netProfit: 7, issuedInvoices: 2, products: 4 });
    expect(csv).toContain("Indicateur,Valeur");
    expect(csv).toContain("Revenus,10");
  });
});
