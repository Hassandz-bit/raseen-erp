import { AIChatBox, type Message } from "@/components/AIChatBox";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BellRing, Bot, Building2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function OnboardingPanel({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const createOrganization = trpc.erp.onboarding.createOrganization.useMutation({
    onSuccess: () => {
      toast.success("تم إعداد مؤسستك وتفعيل الوحدات الأساسية.");
      onComplete();
    },
    onError: error => toast.error(error.message || "تعذر إعداد المؤسسة الآن."),
  });

  return (
    <section className="mx-auto max-w-3xl space-y-6" dir="rtl">
      <div className="surface relative overflow-hidden rounded-3xl border p-7 md:p-10">
        <div className="absolute -left-12 -top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div><p className="mt-6 text-sm text-primary">خطوة واحدة للبدء</p><h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">أنشئ مساحة مؤسستك الآمنة</h1><p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">سننشئ المؤسسة وعضوية المالك والوحدات الأساسية في سياق معزول. لا نضيف منتجات أو فواتير أو سجلات افتراضية إلى بياناتك.</p><form className="mt-7 flex flex-col gap-3 sm:flex-row" onSubmit={event => { event.preventDefault(); createOrganization.mutate({ name }); }}><Input value={name} onChange={event => setName(event.target.value)} placeholder="اسم المؤسسة" className="h-12 rounded-xl border-white/10 bg-white/[.035] text-right text-sm text-white" /><Button type="submit" disabled={createOrganization.isPending || name.trim().length < 2} className="h-12 rounded-xl bg-primary px-5 text-primary-foreground">{createOrganization.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إعداد المؤسسة"}</Button></form></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="surface-soft rounded-2xl border p-4"><ShieldCheck className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">عزل متعدد المؤسسات</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">لكل مؤسسة سياق وصول مستقل.</p></div><div className="surface-soft rounded-2xl border p-4"><Sparkles className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">وحدات مفعلة</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">المخزون والمبيعات والمالية وغيرها.</p></div><div className="surface-soft rounded-2xl border p-4"><Bot className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-semibold text-white">مساعد محكوم</p><p className="mt-1 text-[11px] leading-6 text-muted-foreground">إجابات ضمن بيانات مؤسستك فقط.</p></div></div>
    </section>
  );
}

function WorkspaceContent({ organizationName, activeModules }: { organizationName: string; activeModules: number }) {
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
    <section className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div className="surface relative overflow-hidden rounded-3xl border p-6 md:p-8"><div className="absolute -left-10 -top-8 h-44 w-44 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Bot className="h-6 w-6" /></div><div><p className="text-sm text-primary">{organizationName}</p><h1 className="mt-1 text-2xl font-bold text-white">مساعد نواة الذكي</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">استفسر عن مؤشرات مؤسستك أو اطلب تلخيصاً عملياً. يمر كل طلب بحارس العضوية والوحدة قبل الوصول إلى أي ملخص تشغيلي.</p></div></div><Badge className="w-fit gap-2 border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-300 hover:bg-emerald-400/10"><ShieldCheck className="h-4 w-4" />{activeModules} وحدات مفعلة</Badge></div></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]"><AIChatBox messages={messages} onSendMessage={handleSendMessage} isLoading={askAssistant.isPending} height="590px" className="surface overflow-hidden rounded-3xl border" emptyStateMessage="كيف يمكنني مساعدتك في إدارة مؤسستك اليوم؟" placeholder="اكتب استفسارك التشغيلي هنا..." suggestedPrompts={["ما أهم المؤشرات التي تستحق المراجعة؟", "لخّص حالة الفواتير والمخزون.", "ما التوصية التشغيلية التالية؟"]} /><aside className="space-y-4"><div className="surface rounded-3xl border p-5"><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><p className="text-sm font-semibold">حدود المساعد</p></div><p className="mt-3 text-xs leading-7 text-muted-foreground">يتلقى المساعد ملخصاً مخصصاً للمؤسسة الحالية فقط. لا يملك وصولاً مستقلاً إلى المؤسسات الأخرى ولا يغير السجلات التشغيلية.</p></div><div className="rounded-3xl border border-primary/15 bg-primary/[.06] p-5"><p className="text-xs font-semibold text-primary">اقتراح عملي</p><p className="mt-2 text-sm font-bold leading-7 text-white">ابدأ بمراجعة التنبيهات الحرجة ثم الفواتير المستحقة.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">تعتمد التوصيات على البيانات المتاحة ضمن اشتراك مؤسستك وصلاحياتك.</p></div><div className="surface rounded-3xl border p-5"><div className="flex items-center gap-2 text-primary"><BellRing className="h-4 w-4" /><p className="text-sm font-semibold">تقييم التنبيهات</p></div><p className="mt-2 text-xs leading-6 text-muted-foreground">يفحص مؤشرات المؤسسة الحالية ويرسل لمالك المنصة عند وجود حالة حرجة.</p><Button onClick={() => evaluateAlerts.mutate()} disabled={evaluateAlerts.isPending} className="mt-4 h-10 w-full rounded-xl bg-primary text-primary-foreground">{evaluateAlerts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "فحص الآن"}</Button>{alertReasons.length > 0 && <ul className="mt-3 space-y-2 text-[11px] leading-6 text-amber-200">{alertReasons.map(reason => <li key={reason} className="rounded-xl bg-amber-300/10 px-3 py-2">{reason}</li>)}</ul>}</div></aside></div>
    </section>
  );
}

export default function Workspace() {
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false });
  return <DashboardLayout>{bootstrap.isLoading ? <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : bootstrap.data ? <WorkspaceContent organizationName={bootstrap.data.organization.name} activeModules={bootstrap.data.modules.filter(module => module.status === "active").length} /> : <OnboardingPanel onComplete={() => bootstrap.refetch()} />}</DashboardLayout>;
}
