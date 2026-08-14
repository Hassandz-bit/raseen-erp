import { AIChatBox, type Message } from "@/components/AIChatBox";
import DashboardLayout from "@/components/DashboardLayout";
import NawaFlow from "@/components/NawaFlow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing, Bot, Building2, Check, FileDown, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const operationalModules = [
  { key: "inventory", label: "المخزون", action: "إضافة صنف" },
  { key: "sales", label: "المبيعات", action: "إنشاء فاتورة" },
  { key: "purchases", label: "المشتريات", action: "أمر شراء" },
  { key: "finance", label: "المالية", action: "تسجيل معاملة" },
  { key: "hr", label: "الموارد البشرية", action: "إضافة موظف" },
] as const;
type OperationalModuleKey = (typeof operationalModules)[number]["key"];

function OperationsPanel() {
  const { direction } = useLanguage();
  const [module, setModule] = useState<OperationalModuleKey>("inventory");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const selected = operationalModules.find(item => item.key === module)!;
  const records = trpc.erp.operations.list.useQuery({ module });
  const create = trpc.erp.operations.create.useMutation({
    onSuccess: result => {
      toast.success(result.label);
      setTitle("");
      setReference("");
      setAmount("");
      records.refetch();
    },
    onError: error => toast.error(error.message || "تعذر حفظ السجل الآن."),
  });

  return <section className="surface overflow-hidden rounded-3xl border" dir={direction}><div className="border-b border-white/8 px-5 py-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm font-semibold text-white">الوحدات التشغيلية</p><p className="mt-1 text-xs text-muted-foreground">إدارة سجلات المؤسسة الفعلية ضمن نطاق العضوية والاشتراك.</p></div><div className="thin-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">{operationalModules.map(item => <button key={item.key} onClick={() => setModule(item.key)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${module === item.key ? "bg-primary text-primary-foreground" : "bg-white/[.035] text-slate-300 hover:bg-white/[.07]"}`}>{item.label}</button>)}</div></div></div><div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="thin-scrollbar overflow-x-auto"><table className="w-full min-w-[560px] text-start"><thead className="text-[11px] text-muted-foreground"><tr><th className="pb-3 font-medium">العنصر</th><th className="pb-3 font-medium">المرجع</th><th className="pb-3 font-medium">القيمة</th><th className="pb-3 font-medium">الحالة</th></tr></thead><tbody>{records.isLoading ? <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل سجلات الوحدة...</td></tr> : records.data?.length ? records.data.map(record => <tr key={record.id} className="border-t border-white/[.06]"><td className="py-3 text-sm text-white">{record.title}</td><td className="latin py-3 text-xs text-muted-foreground">{record.reference}</td><td className="py-3 text-sm text-slate-300">{record.amount}</td><td className="py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{record.status}</span></td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">لا توجد سجلات بعد. أضف أول سجل لهذه الوحدة.</td></tr>}</tbody></table></div><form onSubmit={event => { event.preventDefault(); create.mutate({ module, title, reference: reference || undefined, amount: amount ? Number(amount) : undefined }); }} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-sm font-semibold text-white">{selected.action}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">ينشأ السجل داخل المؤسسة الحالية فقط.</p><div className="mt-4 space-y-3"><Input value={title} onChange={event => setTitle(event.target.value)} required placeholder={module === "hr" ? "اسم الموظف" : "اسم السجل"} className="h-10 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Input value={reference} onChange={event => setReference(event.target.value)} placeholder="مرجع اختياري" className="h-10 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="القيمة (اختياري)" className="h-10 rounded-xl border-white/10 bg-white/[.035] text-start text-sm text-white" /><Button type="submit" disabled={create.isPending || title.trim().length < 2} className="h-10 w-full rounded-xl bg-primary text-primary-foreground">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : selected.action}</Button></div></form></div></section>;
}

function InsightsPanel({ modules }: { modules: { key: string; status: string }[] }) {
  const report = trpc.erp.reports.summary.useQuery();
  const notifications = trpc.erp.notifications.list.useQuery();
  const markRead = trpc.erp.notifications.markRead.useMutation({ onSuccess: () => notifications.refetch() });
  const exportReport = () => {
    if (!report.data) return;
    const lines = ["المؤشر,القيمة", `الإيرادات,${report.data.totalIncome}`, `المصروفات,${report.data.totalExpenses}`, `صافي الربح,${report.data.netProfit}`, `الفواتير الصادرة,${report.data.issuedInvoices}`, `عدد الأصناف,${report.data.products}`];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nawa-erp-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="grid gap-5 xl:grid-cols-3" dir="rtl"><article className="surface rounded-3xl border p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">ملخص مالي</p><p className="mt-1 text-xs text-muted-foreground">الشهر الحالي</p></div><button onClick={exportReport} disabled={!report.data} className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary hover:bg-primary/15" aria-label="تصدير CSV"><FileDown className="h-4 w-4" /></button></div>{report.isLoading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-primary" /> : report.data ? <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-emerald-400/8 p-3"><p className="text-[11px] text-muted-foreground">الإيرادات</p><p className="latin mt-1 text-lg font-bold text-emerald-300">{report.data.totalIncome}</p></div><div className="rounded-2xl bg-rose-400/8 p-3"><p className="text-[11px] text-muted-foreground">المصروفات</p><p className="latin mt-1 text-lg font-bold text-rose-300">{report.data.totalExpenses}</p></div><div className="col-span-2 rounded-2xl bg-primary/8 p-3"><p className="text-[11px] text-muted-foreground">صافي الربح</p><p className="latin mt-1 text-xl font-bold text-primary">{report.data.netProfit} ر.س</p></div></div> : <p className="py-10 text-center text-xs text-muted-foreground">تعذر تحميل ملخص التقرير.</p>}</article><article className="surface rounded-3xl border p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">مركز الإشعارات</p><p className="mt-1 text-xs text-muted-foreground">تنبيهات المؤسسة</p></div><Bell className="h-4 w-4 text-primary" /></div><div className="thin-scrollbar mt-4 max-h-48 space-y-2 overflow-y-auto">{notifications.isLoading ? <Loader2 className="mx-auto my-10 h-5 w-5 animate-spin text-primary" /> : notifications.data?.length ? notifications.data.map(item => <button key={item.id} onClick={() => item.isRead === "no" && markRead.mutate({ notificationId: item.id })} className="w-full rounded-xl border border-white/[.06] bg-white/[.025] p-3 text-right hover:bg-white/[.05]"><div className="flex gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.isRead === "no" ? "bg-primary" : "bg-slate-600"}`} /><div><p className="text-xs font-semibold text-white">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.content}</p></div></div></button>) : <p className="py-10 text-center text-xs text-muted-foreground">لا توجد إشعارات مسجلة.</p>}</div></article><article className="surface rounded-3xl border p-5"><div><p className="text-sm font-semibold text-white">الوحدات والاشتراك</p><p className="mt-1 text-xs text-muted-foreground">حالة وصول مؤسستك</p></div><div className="mt-4 space-y-2">{modules.map(module => <div key={module.key} className="flex items-center justify-between rounded-xl bg-white/[.025] px-3 py-2.5"><span className="text-xs text-slate-200">{operationalModules.find(item => item.key === module.key)?.label ?? module.key}</span>{module.status === "active" ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300"><Check className="h-3.5 w-3.5" />مفعلة</span> : <button onClick={() => toast.info("تواصل مع مسؤول الاشتراك لطلب ترقية الوحدة.")} className="flex items-center gap-1 text-[11px] font-semibold text-primary"><LockKeyhole className="h-3.5 w-3.5" />مقفلة</button>}</div>)}</div></article></section>;
}

function OnboardingPanel({ onComplete }: { onComplete: () => void }) {
  const { direction, t } = useLanguage();
  const [name, setName] = useState("");
  const createOrganization = trpc.erp.onboarding.createOrganization.useMutation({
    onSuccess: () => {
      toast.success("تم إعداد مؤسستك وتفعيل الوحدات الأساسية.");
      onComplete();
    },
    onError: error => toast.error(error.message || "تعذر إعداد المؤسسة الآن."),
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6" dir={direction}>
      <div className="surface relative overflow-hidden rounded-3xl border p-7 md:p-10">
        <div className="absolute -left-12 -top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div><p className="mt-6 text-sm text-primary">{t("onboardingEyebrow")}</p><h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">{t("onboardingTitle")}</h1><p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">{t("onboardingDescription")}</p><form className="mt-7 flex flex-col gap-3 sm:flex-row" onSubmit={event => { event.preventDefault(); createOrganization.mutate({ name }); }}><Input value={name} onChange={event => setName(event.target.value)} placeholder={t("organizationNamePlaceholder")} className="h-12 rounded-xl border-white/10 bg-white/[.035] text-right text-sm text-white" /><Button type="submit" disabled={createOrganization.isPending || name.trim().length < 2} className="h-12 rounded-xl bg-primary px-5 text-primary-foreground">{createOrganization.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("setupOrganization")}</Button></form></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="surface-soft rounded-2xl border p-4"><ShieldCheck className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">{t("tenantIsolation")}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{t("tenantIsolationDescription")}</p></div><div className="surface-soft rounded-2xl border p-4"><Sparkles className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">{t("enabledModules")}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{t("enabledModulesDescription")}</p></div><div className="surface-soft rounded-2xl border p-4"><Bot className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">{t("governedAssistant")}</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">{t("governedAssistantDescription")}</p></div></div>
    </section>
  );
}

function WorkspaceContent({ organizationName, activeModules, modules }: { organizationName: string; activeModules: number; modules: { key: string; status: string }[] }) {
  const { direction } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [alertReasons, setAlertReasons] = useState<string[]>([]);
  const askAssistant = trpc.erp.ai.ask.useMutation({
    onSuccess: response => setMessages(current => [...current, { role: "assistant", content: response.reply }]),
    onError: error => toast.error(error.message || "تعذر تنفيذ طلب المساعد الآن."),
  });
  const handleSendMessage = (content: string) => {
    setMessages(current => [...current, { role: "user", content }]);
    askAssistant.mutate({ prompt: content });
  };
  const evaluateAlerts = trpc.erp.alerts.evaluate.useMutation({
    onSuccess: result => {
      setAlertReasons(result.reasons);
      if (result.reasons.length === 0) toast.success("لا توجد تنبيهات حرجة ضمن البيانات الحالية.");
      else if (result.notified) toast.success("تم تقييم التنبيهات وإرسال إشعار لمالك المنصة.");
      else toast.info("تم تقييم التنبيهات، وتعذر تسليم الإشعار الخارجي مؤقتاً.");
    },
    onError: error => toast.error(error.message || "تعذر تقييم التنبيهات الآن."),
  });

  return (
    <section className="mx-auto max-w-6xl space-y-6" dir={direction}>
      <div className="surface relative overflow-hidden rounded-3xl border p-6 md:p-8"><div className="absolute -left-10 -top-8 h-44 w-44 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Bot className="h-6 w-6" /></div><div><p className="text-sm text-primary">{organizationName}</p><h1 className="mt-1 text-2xl font-bold text-white">مساعد نواة الذكي</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">استفسر عن مؤشرات مؤسستك أو اطلب تلخيصاً عملياً. يمر كل طلب بحارس العضوية والوحدة قبل الوصول إلى أي ملخص تشغيلي.</p></div></div><Badge className="w-fit gap-2 border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-300 hover:bg-emerald-400/10"><ShieldCheck className="h-4 w-4" />{activeModules} وحدات مفعلة</Badge></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]"><AIChatBox messages={messages} onSendMessage={handleSendMessage} isLoading={askAssistant.isPending} height="590px" className="surface overflow-hidden rounded-3xl border" emptyStateMessage="كيف يمكنني مساعدتك في إدارة مؤسستك اليوم؟" placeholder="اكتب استفسارك التشغيلي هنا..." suggestedPrompts={["ما أهم المؤشرات التي تستحق المراجعة؟", "لخّص حالة الفواتير والمخزون.", "ما التوصية التشغيلية التالية؟"]} /><aside className="space-y-4"><div className="surface rounded-3xl border p-5"><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><p className="text-sm font-semibold">حدود المساعد</p></div><p className="mt-3 text-xs leading-7 text-muted-foreground">يتلقى المساعد ملخصاً مخصصاً للمؤسسة الحالية فقط. لا يملك وصولاً مستقلاً إلى المؤسسات الأخرى ولا يغير السجلات التشغيلية.</p></div><div className="rounded-3xl border border-primary/15 bg-primary/[.06] p-5"><p className="text-xs font-semibold text-primary">اقتراح عملي</p><p className="mt-2 text-sm font-bold leading-7 text-white">ابدأ بمراجعة التنبيهات الحرجة ثم الفواتير المستحقة.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">تعتمد التوصيات على البيانات المتاحة ضمن اشتراك مؤسستك وصلاحياتك.</p></div><div className="surface rounded-3xl border p-5"><div className="flex items-center gap-2 text-primary"><BellRing className="h-4 w-4" /><p className="text-sm font-semibold">تقييم التنبيهات</p></div><p className="mt-2 text-xs leading-6 text-muted-foreground">يفحص مؤشرات المؤسسة الحالية ويرسل لمالك المنصة عند وجود حالة حرجة.</p><Button onClick={() => evaluateAlerts.mutate()} disabled={evaluateAlerts.isPending} className="mt-4 h-10 w-full rounded-xl bg-primary text-primary-foreground">{evaluateAlerts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "فحص الآن"}</Button>{alertReasons.length > 0 && <ul className="mt-3 space-y-2 text-[11px] leading-6 text-amber-200">{alertReasons.map(reason => <li key={reason} className="rounded-xl bg-amber-300/10 px-3 py-2">{reason}</li>)}</ul>}</div></aside></div>
      <OperationsPanel />
      <InsightsPanel modules={modules} />
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
