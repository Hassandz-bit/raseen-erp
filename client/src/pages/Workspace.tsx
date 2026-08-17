import { AIChatBox, type Message } from "@/components/AIChatBox";
import DashboardLayout from "@/components/DashboardLayout";
import { FinancialSummaryCards } from "@/components/FinancialSummaryCards";
import NawaFlow from "@/components/NawaFlow";
import { WorkspaceState } from "@/components/WorkspaceState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { operationalPanelCopy, workspaceAssistantCopy, workspaceOverviewCopy } from "@/i18n/translations";
import { useTheme } from "@/contexts/ThemeContext";
import { buildWorkspaceSummaryCsv } from "@/lib/workspaceSummaryExport";
import { createDocumentPreviewPdf } from "@/lib/documentPreviewExport";
import { buildWorkspaceReportExcel, type WorkspaceReportRow } from "@/lib/workspaceReportExport";
import { trpc } from "@/lib/trpc";
import { BarChart3, Bell, BellRing, Bot, Building2, Check, FileDown, FileSpreadsheet, FileText, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

const operationalModules = [
  { key: "inventory" },
  { key: "sales" },
  { key: "purchases" },
  { key: "finance" },
  { key: "hr" },
] as const;
type OperationalModuleKey = (typeof operationalModules)[number]["key"];

function OperationsPanel() {
  const { direction, t, formatCurrency, language } = useLanguage();
  const ui = operationalPanelCopy[language];
  const [module, setModule] = useState<OperationalModuleKey>("inventory");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const selectedBase = operationalModules.find(item => item.key === module)!;
  const selected = { ...selectedBase, action: t({ inventory: "createProduct", sales: "createInvoice", purchases: "createOrder", finance: "createTransaction", hr: "addEmployee" }[module] as never) };
  const records = trpc.erp.operations.list.useQuery({ module });
  const create = trpc.erp.operations.create.useMutation({
    onSuccess: result => {
      toast.success(result.label);
      setTitle("");
      setReference("");
      setAmount("");
      records.refetch();
    },
    onError: error => toast.error(error.message || t("error")),
  });

  return <section className="surface overflow-hidden rounded-3xl border" dir={direction}><div className="border-b border-white/8 px-5 py-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm font-semibold text-white">{ui.title}</p><p className="mt-1 text-xs text-muted-foreground">{ui.description}</p></div><div className="thin-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">{operationalModules.map(item => <button key={item.key} onClick={() => setModule(item.key)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${module === item.key ? "bg-primary text-primary-foreground" : "bg-white/[.035] text-slate-300 hover:bg-white/[.07]"}`}>{t(item.key as never)}</button>)}</div></div></div><div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="thin-scrollbar overflow-x-auto"><table className="w-full min-w-[560px] text-start"><thead className="text-[11px] text-muted-foreground"><tr><th className="pb-3 font-medium">{ui.item}</th><th className="pb-3 font-medium">{ui.reference}</th><th className="pb-3 font-medium">{ui.value}</th><th className="pb-3 font-medium">{ui.status}</th></tr></thead><tbody>{records.isLoading ? <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">{ui.loading}</td></tr> : records.data?.length ? records.data.map(record => <tr key={record.id} className="border-t border-white/[.06]"><td className="py-3 text-sm text-white">{record.title}</td><td className="latin py-3 text-xs text-muted-foreground">{record.reference}</td><td className="py-3 text-sm text-slate-300">{record.amount ? formatCurrency(Number(record.amount)) : "—"}</td><td className="py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{record.status}</span></td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">{ui.empty}</td></tr>}</tbody></table></div><form onSubmit={event => { event.preventDefault(); create.mutate({ module, title, reference: reference || undefined, amount: amount ? Number(amount) : undefined }); }} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-sm font-semibold text-white">{selected.action}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{ui.organizationScope}</p><div className="mt-4 space-y-3"><Input value={title} onChange={event => setTitle(event.target.value)} required placeholder={module === "hr" ? ui.employeeName : ui.recordName} className="h-10 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Input value={reference} onChange={event => setReference(event.target.value)} placeholder={ui.optionalReference} className="h-10 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder={ui.optionalValue} className="h-10 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Button type="submit" disabled={create.isPending || title.trim().length < 2} className="h-10 w-full rounded-xl bg-primary text-primary-foreground">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : selected.action}</Button></div></form></div></section>;
}

export function OperationalOverview({ modules }: { modules: { key: string; status: string }[] }) {
  const { direction, language, t, formatCurrency, formatNumber } = useLanguage();
  const copy = workspaceOverviewCopy[language];
  const [selectedModule, setSelectedModule] = useState(() => modules[0]?.key ?? "inventory");
  const report = trpc.erp.reports.summary.useQuery();
  const commerce = trpc.erp.reports.commerceSummary.useQuery();
  const notifications = trpc.erp.notifications.list.useQuery();
  const refreshing = report.isFetching || commerce.isFetching || notifications.isFetching;
  const activeModules = modules.filter(module => module.status === "active").length;
  const unreadNotifications = notifications.data?.filter(item => item.isRead === "no").length ?? 0;
  const metrics = [
    { key: "inventory", label: t("lowStockProducts"), value: commerce.data ? formatNumber(commerce.data.lowStockProducts) : "—" },
    { key: "sales", label: t("issuedValue"), value: commerce.data ? formatCurrency(commerce.data.issuedValue) : "—" },
    { key: "purchases", label: t("openPurchaseOrders"), value: commerce.data ? formatNumber(commerce.data.openPurchaseOrders) : "—" },
    { key: "finance", label: t("netProfit"), value: report.data ? formatCurrency(report.data.netProfit) : "—" },
    { key: "reports", label: copy.unreadNotifications, value: formatNumber(unreadNotifications) },
  ];
  const selectedMetric = metrics.find(metric => metric.key === selectedModule);
  const statusLabel = (status: string) => status === "active" ? copy.active : status === "suspended" ? copy.suspended : copy.expired;
  const refresh = () => {
    void Promise.all([report.refetch(), commerce.refetch(), notifications.refetch()]).then(() => toast.success(copy.refreshed));
  };

  return <section className="surface rounded-3xl border p-5 md:p-6" dir={direction}><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-semibold text-white">{copy.title}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{copy.description}</p></div><Button variant="outline" onClick={refresh} disabled={refreshing} className="h-10 gap-2 rounded-xl border-white/10 bg-white/[.03] text-slate-200"><Loader2 className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />{copy.refresh}</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><article className="rounded-2xl border border-primary/15 bg-primary/[.06] p-4"><p className="text-[11px] text-muted-foreground">{copy.activeModules}</p><p className="mt-2 text-xl font-bold text-primary">{formatNumber(activeModules)} / {formatNumber(modules.length)}</p></article><article className="rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-4"><p className="text-[11px] text-muted-foreground">{copy.unreadNotifications}</p><p className="mt-2 text-xl font-bold text-amber-200">{formatNumber(unreadNotifications)}</p></article><article className="rounded-2xl border border-sky-300/15 bg-sky-300/[.06] p-4"><p className="text-[11px] text-muted-foreground">{copy.selectedModule}</p><p className="mt-2 text-sm font-bold text-sky-200">{selectedMetric ? `${selectedMetric.label} · ${selectedMetric.value}` : copy.noMetric}</p></article></div><div className="thin-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{modules.map(module => <button key={module.key} type="button" aria-pressed={selectedModule === module.key} onClick={() => setSelectedModule(module.key)} className={`min-w-36 shrink-0 rounded-2xl border p-3 text-start transition-all duration-200 active:scale-[.97] ${selectedModule === module.key ? "border-primary/35 bg-primary/[.10] shadow-[0_8px_24px_rgba(217,180,107,.08)]" : "border-white/[.07] bg-white/[.025] hover:bg-white/[.06]"}`}><p className="text-xs font-semibold text-white">{t(module.key as never)}</p><p className={`mt-2 text-[11px] font-medium ${module.status === "active" ? "text-primary" : module.status === "suspended" ? "text-amber-200" : "text-destructive"}`}>{statusLabel(module.status)}</p></button>)}</div></section>;
}

export function InsightsPanel({ modules }: { modules: { key: string; status: string }[] }) {
  const { t, formatCurrency, formatNumber, formatDate, direction } = useLanguage();
  const reportQuery = trpc.erp.reports.summary.useQuery();
  const report = reportQuery;
  const commerceQuery = trpc.erp.reports.commerceSummary.useQuery();
  const commerce = commerceQuery;
  const notificationsQuery = trpc.erp.notifications.list.useQuery();
  const notifications = notificationsQuery;
  const markRead = trpc.erp.notifications.markRead.useMutation({ onSuccess: () => notifications.refetch() });
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRows = (): WorkspaceReportRow[] => report.data && commerce.data ? [
    { label: t("revenue"), value: formatCurrency(report.data.totalIncome) }, { label: t("expenses"), value: formatCurrency(report.data.totalExpenses) }, { label: t("netProfit"), value: formatCurrency(report.data.netProfit) }, { label: t("issuedInvoices"), value: formatNumber(report.data.issuedInvoices) }, { label: t("productsCount"), value: formatNumber(report.data.products) }, { label: t("openInvoices"), value: formatNumber(commerce.data.openInvoices) }, { label: t("openPurchaseOrders"), value: formatNumber(commerce.data.openPurchaseOrders) }, { label: t("lowStockProducts"), value: formatNumber(commerce.data.lowStockProducts) }, { label: t("issuedValue"), value: formatCurrency(commerce.data.issuedValue) },
  ] : [];
  const download = (filename: string, type: string, content: BlobPart) => { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); };
  const exportCsv = () => {
    if (!report.data) return;
    const csv = buildWorkspaceSummaryCsv({ metric: t("metric"), value: t("value"), revenue: t("revenue"), expenses: t("expenses"), netProfit: t("netProfit"), issuedInvoices: t("issuedInvoices"), products: t("productsCount") }, report.data, { formatCurrency, formatNumber });
    download("nawa-erp-report.csv", "text/csv;charset=utf-8", "\ufeff" + csv);
  };
  const exportExcel = () => { const rows = reportRows(); if (rows.length) download("nawa-erp-report.xls", "application/vnd.ms-excel;charset=utf-8", "\ufeff" + buildWorkspaceReportExcel(t("reports"), formatDate(new Date()), rows)); };
  const exportPdf = async () => { const rows = reportRows(); if (!report.data || !rows.length) return; setExportingPdf(true); try { const result = await createDocumentPreviewPdf({ direction, title: t("reports"), date: formatDate(new Date()), documentLabel: t("financialSummary"), amount: formatCurrency(report.data.netProfit), rows, footer: t("organizationAccessStatus"), paperSize: "A4" }, "nawa-erp-report.pdf"); download(result.filename, "application/pdf", result.blob); } catch { toast.error(t("error")); } finally { setExportingPdf(false); } };
  if (commerce.isLoading || notifications.isLoading) return <section className="grid gap-5 xl:grid-cols-4" dir={direction}><article className="surface col-span-full rounded-3xl border"><WorkspaceState label={t("loading")} loading /></article></section>;
  if (report.isError || commerce.isError || notifications.isError) return <section className="grid gap-5 xl:grid-cols-4" dir={direction}><article className="surface col-span-full rounded-3xl border"><WorkspaceState label={t("error")} tone="error" /></article></section>;
  if (!report.data && !commerce.data && !notifications.data?.length) return <section className="grid gap-5 xl:grid-cols-4" dir={direction}><article className="surface col-span-full rounded-3xl border"><WorkspaceState label={t("empty")} /></article></section>;
  return <section className="grid gap-5 xl:grid-cols-4" dir={direction}><article className="surface rounded-3xl border p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">{t("financialSummary")}</p><p className="mt-1 text-xs text-muted-foreground">{t("currentMonth")}</p></div><div className="flex gap-1"><button onClick={exportCsv} disabled={!report.data} className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary" aria-label={t("exportCsv")}><FileDown className="h-4 w-4" /></button><button onClick={exportExcel} disabled={!report.data || !commerce.data} className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary" aria-label={t("exportSpreadsheet")}><FileSpreadsheet className="h-4 w-4" /></button><button onClick={exportPdf} disabled={!report.data || !commerce.data || exportingPdf} className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary" aria-label={t("downloadPdf")}>{exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}</button></div></div>{report.isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-primary" /> : report.data ? <FinancialSummaryCards values={report.data} /> : <p className="py-10 text-center text-xs text-muted-foreground">{t("reportLoadError")}</p>}</article><article className="surface rounded-3xl border p-5"><p className="text-sm font-semibold text-white">{t("commerceSnapshot")}</p>{commerce.isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-primary" /> : commerce.data ? <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-sky-400/8 p-3"><p className="text-[11px] text-muted-foreground">{t("openInvoices")}</p><p className="mt-1 text-lg font-bold text-sky-300">{formatNumber(commerce.data.openInvoices)}</p></div><div className="rounded-2xl bg-amber-400/8 p-3"><p className="text-[11px] text-muted-foreground">{t("lowStockProducts")}</p><p className="mt-1 text-lg font-bold text-amber-300">{formatNumber(commerce.data.lowStockProducts)}</p></div><div className="col-span-2 rounded-2xl bg-primary/8 p-3"><p className="text-[11px] text-muted-foreground">{t("issuedValue")}</p><p className="mt-1 text-sm font-bold text-primary">{formatCurrency(commerce.data.issuedValue)}</p></div></div> : <p className="py-10 text-center text-xs text-muted-foreground">{t("empty")}</p>}</article><article className="surface rounded-3xl border p-5"><p className="text-sm font-semibold text-white">{t("notificationCenter")}</p><div className="thin-scrollbar mt-4 max-h-48 space-y-2 overflow-y-auto">{notifications.data?.length ? notifications.data.map(item => <button key={item.id} onClick={() => item.isRead === "no" && markRead.mutate({ notificationId: item.id })} className="w-full rounded-xl border border-white/[.06] bg-white/[.025] p-3 text-start"><p className="text-xs font-semibold text-white">{item.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.content}</p></button>) : <p className="py-10 text-center text-xs text-muted-foreground">{t("noNotifications")}</p>}</div></article><article className="surface rounded-3xl border p-5"><p className="text-sm font-semibold text-white">{t("subscriptionModules")}</p><p className="mt-1 text-xs text-muted-foreground">{t("organizationAccessStatus")}</p><div className="mt-4 space-y-2">{modules.map(module => <div key={module.key} className="flex items-center justify-between rounded-xl bg-white/[.025] px-3 py-2.5"><span className="text-xs text-slate-200">{t(module.key as never)}</span><span className="text-[11px] font-semibold text-primary">{module.status === "active" ? t("enabled") : t("locked")}</span></div>)}</div></article></section>;
}

function CommerceDocumentsPanel() {
  const { t, formatCurrency, formatNumber, direction } = useLanguage();
  const invoices = trpc.erp.sales.listInvoices.useQuery();
  const orders = trpc.erp.purchases.listOrders.useQuery();
  const commerce = trpc.erp.reports.commerceSummary.useQuery();
  const statusClass = (status: string) => status === "paid" || status === "received" ? "text-emerald-300" : status === "draft" ? "text-slate-300" : "text-primary";
  return <section className="surface rounded-3xl border p-5" dir={direction}><div className="flex flex-col gap-3 border-b border-white/[.06] pb-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-white">{t("recentDocuments")}</p><p className="mt-1 text-xs text-muted-foreground">{t("commerceInventory")}</p></div><div className="flex flex-wrap gap-2">{commerce.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : commerce.isError ? <span className="text-xs text-destructive">{t("error")}</span> : commerce.data ? <><Badge variant="outline" className="border-amber-400/20 bg-amber-400/10 text-amber-200">{t("commerceAlerts")}: {formatNumber(commerce.data.lowStockProducts + commerce.data.openInvoices + commerce.data.openPurchaseOrders)}</Badge>{commerce.data.lowStockProducts > 0 ? <Badge variant="outline" className="border-amber-400/20 bg-amber-400/10 text-amber-200">{t("lowStockProducts")}: {formatNumber(commerce.data.lowStockProducts)}</Badge> : null}</> : null}</div></div><div className="mt-4 grid gap-5 lg:grid-cols-2"><article><p className="mb-3 text-xs font-semibold text-primary">{t("salesInvoices")}</p>{invoices.isLoading ? <Loader2 className="mx-auto my-8 h-4 w-4 animate-spin text-primary" /> : invoices.isError ? <p className="py-8 text-center text-xs text-destructive">{t("error")}</p> : invoices.data?.length ? <div className="space-y-2">{invoices.data.slice(0, 3).map(invoice => <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.025] px-3 py-2.5"><div><p className="latin text-xs font-semibold text-white">{invoice.invoiceNumber}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatCurrency(Number(invoice.grandTotal))}</p></div><span className={`text-[11px] font-semibold ${statusClass(invoice.status)}`}>{t(invoice.status)}</span></div>)}</div> : <p className="py-8 text-center text-xs text-muted-foreground">{t("empty")}</p>}</article><article><p className="mb-3 text-xs font-semibold text-primary">{t("purchaseOrders")}</p>{orders.isLoading ? <Loader2 className="mx-auto my-8 h-4 w-4 animate-spin text-primary" /> : orders.isError ? <p className="py-8 text-center text-xs text-destructive">{t("error")}</p> : orders.data?.length ? <div className="space-y-2">{orders.data.slice(0, 3).map(order => <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.025] px-3 py-2.5"><div><p className="latin text-xs font-semibold text-white">{order.orderNumber}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatCurrency(Number(order.grandTotal))}</p></div><span className={`text-[11px] font-semibold ${statusClass(order.status)}`}>{t(order.status)}</span></div>)}</div> : <p className="py-8 text-center text-xs text-muted-foreground">{t("empty")}</p>}</article></div></section>;
}

function OnboardingPanel({ onComplete }: { onComplete: () => void }) {
  const { direction, t } = useLanguage();
  const [name, setName] = useState("");
  const createOrganization = trpc.erp.onboarding.createOrganization.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      onComplete();
    },
    onError: error => toast.error(error.message || t("error")),
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6" dir={direction}>
      <div className="surface relative overflow-hidden rounded-3xl border p-7 md:p-10">
        <div className="absolute -left-12 -top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div><p className="mt-6 text-sm text-primary">{t("onboardingEyebrow")}</p><h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">{t("onboardingTitle")}</h1><p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">{t("onboardingDescription")}</p><form className="mt-7 flex flex-col gap-3 sm:flex-row" onSubmit={event => { event.preventDefault(); createOrganization.mutate({ name }); }}><Input value={name} onChange={event => setName(event.target.value)} placeholder={t("organizationNamePlaceholder")} className="h-12 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Button type="submit" disabled={createOrganization.isPending || name.trim().length < 2} className="h-12 rounded-xl bg-primary px-5 text-primary-foreground">{createOrganization.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("setupOrganization")}</Button></form></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="surface-soft rounded-2xl border p-4"><ShieldCheck className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">{t("tenantIsolation")}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{t("tenantIsolationDescription")}</p></div><div className="surface-soft rounded-2xl border p-4"><Sparkles className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">{t("enabledModules")}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{t("enabledModulesDescription")}</p></div><div className="surface-soft rounded-2xl border p-4"><Bot className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">{t("governedAssistant")}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{t("governedAssistantDescription")}</p></div></div>
    </section>
  );
}

function WorkspaceContent({ organizationName, activeModules, modules }: { organizationName: string; activeModules: number; modules: { key: string; status: string }[] }) {
  const { direction, language, t } = useLanguage();
  const assistantCopy = workspaceAssistantCopy[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [alertReasons, setAlertReasons] = useState<string[]>([]);
  const [analysisDomain, setAnalysisDomain] = useState<"commerce" | "inventory" | "distribution" | "manufacturing" | "finance" | "hr">("commerce");
  const commerceInsight = trpc.erp.reports.commerceSummary.useQuery();
  const domainChoices = language === "ar"
    ? [{ key: "commerce", label: "التجارة" }, { key: "inventory", label: "المخزون" }, { key: "distribution", label: "التوزيع" }, { key: "manufacturing", label: "التصنيع" }, { key: "finance", label: "المالية" }, { key: "hr", label: "الموارد البشرية" }]
    : language === "fr"
      ? [{ key: "commerce", label: "Commerce" }, { key: "inventory", label: "Stock" }, { key: "distribution", label: "Distribution" }, { key: "manufacturing", label: "Production" }, { key: "finance", label: "Finance" }, { key: "hr", label: "Ressources humaines" }]
      : [{ key: "commerce", label: "Commerce" }, { key: "inventory", label: "Inventory" }, { key: "distribution", label: "Distribution" }, { key: "manufacturing", label: "Manufacturing" }, { key: "finance", label: "Finance" }, { key: "hr", label: "Human resources" }];
  const askAssistant = trpc.erp.ai.ask.useMutation({
    onSuccess: response => setMessages(current => [...current, { role: "assistant", content: [response.recommendation, response.evidence.length ? `\n\n**الدليل:**\n${response.evidence.map(item => `- ${item}`).join("\n")}` : "", response.proposedAction ? `\n\n**إجراء مقترح (يتطلب موافقة بشرية):** ${response.proposedAction}` : ""].join("") }]),
    onError: error => toast.error(error.message || t("assistantRequestError")),
  });
  const handleSendMessage = (content: string) => {
    setMessages(current => [...current, { role: "user", content }]);
    askAssistant.mutate({ prompt: `[analysis_domain:${analysisDomain}] ${content}` });
  };
  const evaluateAlerts = trpc.erp.alerts.evaluate.useMutation({
    onSuccess: result => {
      setAlertReasons(result.reasons);
      if (result.reasons.length === 0) toast.success(t("noCriticalAlerts"));
      else if (result.notified) toast.success(t("alertsNotified"));
      else toast.info(t("alertsDeliveryDeferred"));
    },
    onError: error => toast.error(error.message || t("alertsEvaluationError")),
  });

  return (
    <section className="mx-auto max-w-6xl space-y-6" dir={direction}>
      <div className="surface relative overflow-hidden rounded-3xl border p-6 md:p-8"><div className="absolute -left-10 -top-8 h-44 w-44 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Bot className="h-6 w-6" /></div><div><p className="text-sm text-primary">{organizationName}</p><h1 className="mt-1 text-2xl font-bold text-white">{t("aiAssistantTitle")}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{assistantCopy.assistantDescription}</p></div></div><Badge className="w-fit gap-2 border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-300 hover:bg-emerald-400/10"><ShieldCheck className="h-4 w-4" />{activeModules} {assistantCopy.enabledModules}</Badge></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]"><div className="space-y-4"><div className="surface rounded-3xl border p-4"><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><p className="text-sm font-semibold">{language === "ar" ? "اختر مجال التحليل" : language === "fr" ? "Choisir le domaine d’analyse" : "Choose an analysis domain"}</p></div><div className="thin-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">{domainChoices.map(choice => <button key={choice.key} onClick={() => setAnalysisDomain(choice.key as typeof analysisDomain)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${analysisDomain === choice.key ? "bg-primary text-primary-foreground" : "bg-white/[.04] text-slate-300 hover:bg-white/[.08]"}`}>{choice.label}</button>)}</div><p className="mt-3 text-xs leading-6 text-muted-foreground">{language === "ar" ? "تُرسل للمساعد بيانات موجزة مصرحاً بها للمجال المحدد فقط، ولا ينفذ أي إجراء تلقائياً." : language === "fr" ? "Seules les données résumées autorisées du domaine sélectionné sont envoyées à l’assistant; aucune action n’est automatique." : "Only authorized summary data for the selected domain is sent to the assistant; no action is automatic."}</p></div><AIChatBox messages={messages} onSendMessage={handleSendMessage} isLoading={askAssistant.isPending} height="520px" className="surface overflow-hidden rounded-3xl border" emptyStateMessage={assistantCopy.chatEmpty} placeholder={assistantCopy.chatPlaceholder} suggestedPrompts={[assistantCopy.promptMetrics, assistantCopy.promptCommerce, assistantCopy.promptRecommendation]} /></div><aside className="space-y-4"><div className="surface rounded-3xl border p-5"><div className="flex items-center gap-2 text-primary"><BarChart3 className="h-4 w-4" /><p className="text-sm font-semibold">{language === "ar" ? "مؤشرات التجارة والمخزون" : language === "fr" ? "Indicateurs commerce et stock" : "Commerce & inventory metrics"}</p></div>{commerceInsight.isLoading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-primary" /> : commerceInsight.isError ? <p className="mt-4 text-xs text-destructive">{t("error")}</p> : commerceInsight.data ? <div className="mt-4 space-y-3">{[{ label: language === "ar" ? "الفواتير المفتوحة" : language === "fr" ? "Factures ouvertes" : "Open invoices", value: commerceInsight.data.openInvoices, tone: "bg-sky-400" }, { label: language === "ar" ? "المنتجات منخفضة المخزون" : language === "fr" ? "Produits à faible stock" : "Low-stock products", value: commerceInsight.data.lowStockProducts, tone: "bg-amber-400" }, { label: language === "ar" ? "أوامر الشراء المفتوحة" : language === "fr" ? "Commandes ouvertes" : "Open purchase orders", value: commerceInsight.data.openPurchaseOrders, tone: "bg-emerald-400" }].map(metric => <div key={metric.label}><div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{metric.label}</span><span className="font-semibold text-white">{metric.value}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className={`${metric.tone} h-full rounded-full transition-[width] duration-300`} style={{ width: `${Math.min(100, Math.max(6, metric.value * 12))}%` }} /></div></div>)}</div> : <p className="mt-4 text-xs text-muted-foreground">{t("empty")}</p>}</div><div className="surface rounded-3xl border p-5"><div className="flex items-center gap-2 text-primary"><BellRing className="h-4 w-4" /><p className="text-sm font-semibold">{t("evaluateAlerts")}</p></div><p className="mt-2 text-xs leading-6 text-muted-foreground">{assistantCopy.evaluateDescription}</p><Button onClick={() => evaluateAlerts.mutate()} disabled={evaluateAlerts.isPending} className="mt-4 h-10 w-full rounded-xl bg-primary text-primary-foreground">{evaluateAlerts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("checkNow")}</Button>{alertReasons.length > 0 && <ul className="mt-3 space-y-2 text-[11px] leading-6 text-amber-200">{alertReasons.map(reason => <li key={reason} className="rounded-xl bg-amber-300/10 px-3 py-2">{reason}</li>)}</ul>}</div></aside></div>
      <OperationsPanel />
      <OperationalOverview modules={modules} />
      <InsightsPanel modules={modules} />
      <CommerceDocumentsPanel />
    </section>
  );
}

export default function Workspace() {
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false });
  const { preferences, updatePreferences } = useTheme();
  const saveViewMode = trpc.erp.preferences.saveUser.useMutation();
  const openClassic = () => { updatePreferences({ moduleViewMode: "classic" }); saveViewMode.mutate({ moduleViewMode: "classic" }); };
  const previewFlow = new URLSearchParams(window.location.search).get("view") === "nawa_flow";
  const restrictedNodeIds = bootstrap.data?.membership.roleKey === "owner" ? [] : ["finance", "hr"] as const;
  return <DashboardLayout>{bootstrap.isLoading ? <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : bootstrap.data ? preferences.moduleViewMode === "nawa_flow" || previewFlow ? <NawaFlow modules={bootstrap.data.modules} restrictedNodeIds={[...restrictedNodeIds]} onOpenClassic={openClassic} /> : <WorkspaceContent organizationName={bootstrap.data.organization.name} activeModules={bootstrap.data.modules.filter(module => module.status === "active").length} modules={bootstrap.data.modules} /> : previewFlow ? <NawaFlow modules={[]} onOpenClassic={openClassic} /> : <OnboardingPanel onComplete={() => bootstrap.refetch()} />}</DashboardLayout>;
}
