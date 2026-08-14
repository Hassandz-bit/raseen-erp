import { useLanguage } from "@/contexts/LanguageContext";

export type FinancialSummaryValues = { totalIncome: number; totalExpenses: number; netProfit: number };

export function buildFinancialSummaryCards(values: FinancialSummaryValues, translate: (key: "revenue" | "expenses" | "netProfit") => string, format: (value: number) => string) {
  return [
    { key: "revenue" as const, label: translate("revenue"), value: format(values.totalIncome), tone: "text-emerald-300 bg-emerald-400/8" },
    { key: "expenses" as const, label: translate("expenses"), value: format(values.totalExpenses), tone: "text-rose-300 bg-rose-400/8" },
    { key: "netProfit" as const, label: translate("netProfit"), value: format(values.netProfit), tone: "text-primary bg-primary/8", wide: true },
  ];
}

export function FinancialSummaryCards({ values }: { values: FinancialSummaryValues }) {
  const { formatCurrency, t } = useLanguage();
  const cards = buildFinancialSummaryCards(values, t, formatCurrency);
  return <div className="mt-5 grid grid-cols-2 gap-3">{cards.map(card => <div key={card.key} className={`${card.wide ? "col-span-2" : ""} rounded-2xl p-3 ${card.tone}`}><p className="text-[11px] text-muted-foreground">{card.label}</p><p className="mt-1 text-lg font-bold">{card.value}</p></div>)}</div>;
}
