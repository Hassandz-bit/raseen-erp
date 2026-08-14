import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildExchangeRateExcel, buildExchangeRatePdf } from "@/lib/exchangeRateExport";
import { formatOrganizationDate, formatOrganizationNumber } from "@/lib/formatting";
import { trpc } from "@/lib/trpc";
import { FileSpreadsheet, FileText, Loader2, LockKeyhole, Plus, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function downloadFile(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExchangeRatesPanel() {
  const { language, formatSettings, t } = useLanguage();
  const [quoteCurrencyCode, setQuoteCurrencyCode] = useState("EUR");
  const [rate, setRate] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const settings = trpc.erp.preferences.organization.useQuery();
  const baseCurrencyCode = settings.data?.currencyCode ?? "DZD";
  const filters = useMemo(() => ({ currencyCode: currencyCode.trim().toUpperCase() || undefined, startDate: startDate ? new Date(`${startDate}T00:00:00`) : undefined, endDate: endDate ? new Date(`${endDate}T23:59:59.999`) : undefined }), [currencyCode, startDate, endDate]);
  const rates = trpc.erp.preferences.exchangeRates.useQuery(filters);
  const addRate = trpc.erp.preferences.addExchangeRate.useMutation({
    onSuccess: () => { toast.success(t("exchangeRateAdded")); setRate(""); rates.refetch(); },
    onError: error => toast.error(error.message),
  });
  const text = { title: t("exchangeHistoryTitle"), description: t("exchangeHistoryDescription"), add: t("addExchangeRate"), base: t("baseCurrency"), quote: t("quoteCurrency"), rate: t("exchangeRate"), excel: "Excel", pdf: "PDF", filter: t("filterExchangeRates"), currency: t("currency"), from: t("from"), to: t("to"), clear: t("clearFilters"), effective: t("effectiveDate"), source: t("rateSource"), empty: t("noMatchingExchangeRates"), retry: t("retry") };
  const hasFilters = Boolean(currencyCode || startDate || endDate);
  const exportExcel = () => downloadFile("nawa-exchange-rates.xls", "application/vnd.ms-excel;charset=utf-8", buildExchangeRateExcel(rates.data ?? []));
  const exportPdf = async () => {
    const bytes = await buildExchangeRatePdf(rates.data ?? []);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nawa-exchange-rates.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const add = () => {
    const parsed = Number(rate);
    if (!Number.isFinite(parsed) || parsed <= 0) return toast.error(t("validRateRequired"));
    addRate.mutate({ baseCurrencyCode, quoteCurrencyCode: quoteCurrencyCode.toUpperCase(), rate: parsed, effectiveAt: new Date(), source: "manual" });
  };

  return <section className="surface rounded-3xl border p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold text-white">{text.title}</h2><p className="mt-2 text-sm text-muted-foreground">{text.description}</p></div>
      <div className="flex gap-2">
        <Tooltip><TooltipTrigger asChild><Button variant="outline" onClick={exportExcel} disabled={!rates.data?.length} className="border-white/10 bg-white/[.03] text-slate-200"><FileSpreadsheet className="me-2 h-4 w-4" />{text.excel}</Button></TooltipTrigger><TooltipContent>{t("exportSpreadsheet")}</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="outline" onClick={exportPdf} disabled={!rates.data?.length} className="border-white/10 bg-white/[.03] text-slate-200"><FileText className="me-2 h-4 w-4" />{text.pdf}</Button></TooltipTrigger><TooltipContent>{t("downloadPdf")}</TooltipContent></Tooltip>
      </div>
    </div>
    <div className="mt-6 rounded-2xl border border-white/8 bg-white/[.025] p-4">
      <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-primary" />{text.filter}</p>{hasFilters && <Button variant="ghost" onClick={() => { setCurrencyCode(""); setStartDate(""); setEndDate(""); }} className="h-8 px-2 text-xs text-muted-foreground hover:text-white"><X className="me-1 h-3.5 w-3.5" />{text.clear}</Button>}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">{text.currency}<Input value={currencyCode} maxLength={3} placeholder="DZD" onChange={event => setCurrencyCode(event.target.value)} className="mt-1.5 h-9 border-white/10 bg-white/[.04] text-white" /></label>
        <label className="text-xs text-muted-foreground">{text.from}<Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1.5 h-9 border-white/10 bg-white/[.04] text-white" /></label>
        <label className="text-xs text-muted-foreground">{text.to}<Input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1.5 h-9 border-white/10 bg-white/[.04] text-white" /></label>
      </div>
    </div>
    <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="text-xs text-muted-foreground">{text.base}<span className="relative mt-2 block"><Input readOnly value={baseCurrencyCode} className="h-10 border-white/10 bg-white/[.025] pe-9 text-slate-300" /><LockKeyhole className="pointer-events-none absolute end-3 top-3 h-4 w-4 text-primary" /></span></label>
      <label className="text-xs text-muted-foreground">{text.quote}<Input value={quoteCurrencyCode} maxLength={3} onChange={event => setQuoteCurrencyCode(event.target.value)} className="mt-2 h-10 border-white/10 bg-white/[.04] text-white" /></label>
      <label className="text-xs text-muted-foreground">{text.rate}<Input type="number" min="0" step="0.00000001" value={rate} onChange={event => setRate(event.target.value)} className="mt-2 h-10 border-white/10 bg-white/[.04] text-white" /></label>
      <Tooltip><TooltipTrigger asChild><Button onClick={add} disabled={addRate.isPending || settings.isLoading} className="mt-5 h-10 bg-primary text-primary-foreground">{addRate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent>{text.add}</TooltipContent></Tooltip>
    </div>
    {rates.isLoading ? <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin text-primary" />{t("refreshingExchangeRates")}</div> : rates.isError ? <div className="mt-8 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"><p>{t("exchangeRatesLoadError")}</p><Button onClick={() => rates.refetch()} variant="outline" className="mt-3 border-rose-300/30 bg-transparent text-rose-100">{text.retry}</Button></div> : <div className="thin-scrollbar mt-6 overflow-x-auto"><table className="w-full min-w-[620px] text-start text-sm"><thead className="border-b border-white/10 text-muted-foreground"><tr><th className="p-3">{text.base}</th><th className="p-3">{text.quote}</th><th className="p-3">{text.rate}</th><th className="p-3">{text.effective}</th><th className="p-3">{text.source}</th></tr></thead><tbody>{rates.data?.map(row => <tr key={row.id} className="border-b border-white/[.06]"><td className="p-3 text-white">{row.baseCurrencyCode}</td><td className="p-3 text-white">{row.quoteCurrencyCode}</td><td className="p-3 text-primary">{formatOrganizationNumber(Number(row.rate), { ...formatSettings, decimalPlaces: 8 })}</td><td className="p-3 text-slate-300">{formatOrganizationDate(row.effectiveAt, formatSettings)}</td><td className="p-3 text-slate-300">{row.source}</td></tr>)}{rates.data?.length === 0 && <tr><td colSpan={5} className="p-7 text-center text-muted-foreground">{text.empty}</td></tr>}</tbody></table></div>}
  </section>;
}
