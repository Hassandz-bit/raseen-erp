import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatOrganizationDate, formatOrganizationNumber } from "@/lib/formatting";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function downloadFile(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

export function ExchangeRatesPanel() {
  const { language, formatSettings } = useLanguage();
  const [baseCurrencyCode, setBaseCurrencyCode] = useState("DZD");
  const [quoteCurrencyCode, setQuoteCurrencyCode] = useState("EUR");
  const [rate, setRate] = useState("");
  const rates = trpc.erp.preferences.exchangeRates.useQuery();
  const addRate = trpc.erp.preferences.addExchangeRate.useMutation({ onSuccess: () => { toast.success(language === "ar" ? "تمت إضافة سعر الصرف" : language === "fr" ? "Taux de change ajouté" : "Exchange rate added"); setRate(""); rates.refetch(); }, onError: error => toast.error(error.message) });
  const exportExcel = () => {
    const rows = rates.data ?? [];
    const header = "Base\tQuote\tRate\tEffective date\tSource";
    const values = rows.map(row => `${row.baseCurrencyCode}\t${row.quoteCurrencyCode}\t${row.rate}\t${new Date(row.effectiveAt).toISOString()}\t${row.source}`);
    downloadFile("nawa-exchange-rates.xls", "application/vnd.ms-excel;charset=utf-8", [header, ...values].join("\n"));
  };
  const exportPdf = () => {
    const rows = rates.data ?? [];
    const body = rows.map(row => `<tr><td>${row.baseCurrencyCode}</td><td>${row.quoteCurrencyCode}</td><td>${row.rate}</td><td>${new Date(row.effectiveAt).toLocaleDateString()}</td><td>${row.source}</td></tr>`).join("");
    const popup = window.open("", "nawa-exchange-rates", "noopener,noreferrer,width=860,height=640");
    if (!popup) return toast.error(language === "ar" ? "اسمح بالنوافذ المنبثقة لتصدير PDF" : "Allow popups to export PDF");
    popup.document.write(`<html><head><title>Exchange rates</title><style>body{font-family:Arial;padding:32px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}h1{font-size:20px}</style></head><body><h1>Nawa ERP — Exchange rate history</h1><table><thead><tr><th>Base</th><th>Quote</th><th>Rate</th><th>Effective date</th><th>Source</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };
  const add = () => { const parsed = Number(rate); if (!Number.isFinite(parsed) || parsed <= 0) return toast.error(language === "ar" ? "أدخل سعراً صحيحاً" : "Enter a valid rate"); addRate.mutate({ baseCurrencyCode: baseCurrencyCode.toUpperCase(), quoteCurrencyCode: quoteCurrencyCode.toUpperCase(), rate: parsed, effectiveAt: new Date(), source: "manual" }); };
  const text = language === "ar" ? { title: "سجل أسعار الصرف", description: "سجل يدوي تاريخي؛ لا يغيّر أسعار المعاملات السابقة.", add: "إضافة سعر", base: "الأساس", quote: "الاقتباس", rate: "السعر", excel: "Excel", pdf: "PDF" } : language === "fr" ? { title: "Historique des taux", description: "Historique manuel; les transactions passées ne sont jamais modifiées.", add: "Ajouter", base: "Base", quote: "Contrepartie", rate: "Taux", excel: "Excel", pdf: "PDF" } : { title: "Exchange rate history", description: "Manual historical ledger; it never changes past transaction rates.", add: "Add rate", base: "Base", quote: "Quote", rate: "Rate", excel: "Excel", pdf: "PDF" };
  return <section className="surface rounded-3xl border p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-white">{text.title}</h2><p className="mt-2 text-sm text-muted-foreground">{text.description}</p></div><div className="flex gap-2"><Button title="Export Excel" variant="outline" onClick={exportExcel} disabled={!rates.data?.length} className="border-white/10 bg-white/[.03] text-slate-200"><FileSpreadsheet className="me-2 h-4 w-4" />{text.excel}</Button><Button title="Export PDF via browser print" variant="outline" onClick={exportPdf} disabled={!rates.data?.length} className="border-white/10 bg-white/[.03] text-slate-200"><FileText className="me-2 h-4 w-4" />{text.pdf}</Button></div></div><div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"><label className="text-xs text-muted-foreground">{text.base}<Input value={baseCurrencyCode} maxLength={3} onChange={event => setBaseCurrencyCode(event.target.value)} className="mt-2 h-10 border-white/10 bg-white/[.04] text-white" /></label><label className="text-xs text-muted-foreground">{text.quote}<Input value={quoteCurrencyCode} maxLength={3} onChange={event => setQuoteCurrencyCode(event.target.value)} className="mt-2 h-10 border-white/10 bg-white/[.04] text-white" /></label><label className="text-xs text-muted-foreground">{text.rate}<Input type="number" min="0" step="0.00000001" value={rate} onChange={event => setRate(event.target.value)} className="mt-2 h-10 border-white/10 bg-white/[.04] text-white" /></label><Button title={text.add} onClick={add} disabled={addRate.isPending} className="mt-5 h-10 bg-primary text-primary-foreground">{addRate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button></div>{rates.isLoading ? <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin text-primary" />{language === "ar" ? "جارٍ تحديث الأسعار…" : language === "fr" ? "Mise à jour des taux…" : "Refreshing rates…"}</div> : <div className="thin-scrollbar mt-6 overflow-x-auto"><table className="w-full min-w-[620px] text-start text-sm"><thead className="border-b border-white/10 text-muted-foreground"><tr><th className="p-3">{text.base}</th><th className="p-3">{text.quote}</th><th className="p-3">{text.rate}</th><th className="p-3">{language === "ar" ? "تاريخ السريان" : language === "fr" ? "Date d’effet" : "Effective date"}</th><th className="p-3">{language === "ar" ? "المصدر" : language === "fr" ? "Source" : "Source"}</th></tr></thead><tbody>{rates.data?.map(row => <tr key={row.id} className="border-b border-white/[.06]"><td className="p-3 text-white">{row.baseCurrencyCode}</td><td className="p-3 text-white">{row.quoteCurrencyCode}</td><td className="p-3 text-primary">{formatOrganizationNumber(Number(row.rate), { ...formatSettings, decimalPlaces: 8 })}</td><td className="p-3 text-slate-300">{formatOrganizationDate(row.effectiveAt, formatSettings)}</td><td className="p-3 text-slate-300">{row.source}</td></tr>)}{rates.data?.length === 0 && <tr><td colSpan={5} className="p-7 text-center text-muted-foreground">{language === "ar" ? "لا توجد أسعار صرف مسجلة" : language === "fr" ? "Aucun taux enregistré" : "No exchange rates recorded"}</td></tr>}</tbody></table></div>}</section>;
}
