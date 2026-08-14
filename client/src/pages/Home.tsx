import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  ArrowUpLeft,
  Bell,
  Bot,
  Building2,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  FileBarChart2,
  Grid2X2,
  HelpCircle,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Truck,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SectionKey = "dashboard" | "inventory" | "sales" | "purchases" | "finance" | "hr" | "reports" | "settings";

const navItems: { key: SectionKey; label: string; icon: typeof Grid2X2; module?: string }[] = [
  { key: "dashboard", label: "لوحة التحكم", icon: Grid2X2 },
  { key: "inventory", label: "المخزون", icon: Package, module: "inventory" },
  { key: "sales", label: "المبيعات والفواتير", icon: ReceiptText, module: "sales" },
  { key: "purchases", label: "المشتريات", icon: ShoppingCart, module: "purchases" },
  { key: "finance", label: "الحسابات والمالية", icon: WalletCards, module: "finance" },
  { key: "hr", label: "الموارد البشرية", icon: UsersRound, module: "hr" },
  { key: "reports", label: "التقارير والتحليلات", icon: FileBarChart2, module: "reports" },
  { key: "settings", label: "الإعدادات والصلاحيات", icon: Settings2 },
];

const salesData = [
  { month: "يناير", value: 84 },
  { month: "فبراير", value: 98 },
  { month: "مارس", value: 88 },
  { month: "أبريل", value: 116 },
  { month: "مايو", value: 128 },
  { month: "يونيو", value: 154 },
  { month: "يوليو", value: 143 },
  { month: "أغسطس", value: 172 },
];

const inventoryData = [
  { label: "آمن", value: 62, color: "#46b598" },
  { label: "مراقبة", value: 24, color: "#d9b46b" },
  { label: "منخفض", value: 11, color: "#f38c59" },
  { label: "حرج", value: 3, color: "#ed6167" },
];

const products = [
  { name: "قهوة عربية محمصة", sku: "NWA-CA-001", stock: "1,240", status: "متاح", tone: "green" },
  { name: "عبوة مياه 330 مل", sku: "NWA-WT-032", stock: "320", status: "تنبيه", tone: "amber" },
  { name: "سكر أبيض فاخر", sku: "NWA-SG-117", stock: "75", status: "حرج", tone: "red" },
  { name: "كرتون تعبئة متوسط", sku: "NWA-PK-204", stock: "920", status: "متاح", tone: "green" },
];

const invoices = [
  { no: "INV-24081", customer: "أسواق الندى", value: "18,450 ر.س", status: "مدفوعة", tone: "green" },
  { no: "INV-24080", customer: "شركة الاتجاه", value: "12,880 ر.س", status: "قيد التحصيل", tone: "amber" },
  { no: "INV-24079", customer: "مؤسسة الربيع", value: "8,720 ر.س", status: "مستحقة", tone: "red" },
  { no: "INV-24078", customer: "متاجر أجيال", value: "21,340 ر.س", status: "مدفوعة", tone: "green" },
];

const sectionCopy: Record<Exclude<SectionKey, "dashboard">, { eyebrow: string; title: string; detail: string; icon: typeof Package; stat: string; action: string }> = {
  inventory: { eyebrow: "المخزون", title: "رؤية لحظية للمخزون", detail: "راقب مستويات الأصناف، التنبيهات، والمخزون المحجوز من مساحة واحدة.", icon: Package, stat: "14 تنبيهاً تتطلب الإجراء", action: "إضافة صنف" },
  sales: { eyebrow: "المبيعات", title: "دورة مبيعات أكثر وضوحاً", detail: "أنشئ الفواتير وتابع العملاء والطلبات والتحصيلات بصورة منظمة.", icon: ReceiptText, stat: "6 فواتير قيد التحصيل", action: "إنشاء فاتورة" },
  purchases: { eyebrow: "المشتريات", title: "إمداد مضبوط منذ الطلب", detail: "نسّق الموردين وأوامر الشراء والاستلام قبل أن تؤثر الفجوات على البيع.", icon: ShoppingCart, stat: "3 أوامر بانتظار الاستلام", action: "طلب شراء" },
  finance: { eyebrow: "المالية", title: "الصورة المالية للمؤسسة", detail: "تابع التدفقات والمعاملات والأرباح والخسائر بصلاحيات واضحة.", icon: WalletCards, stat: "هامش الربح 31.8%", action: "تسجيل معاملة" },
  hr: { eyebrow: "الموارد البشرية", title: "إدارة فريقك بثقة", detail: "نظّم الموظفين والحضور وكشوف الرواتب ضمن منظومة المؤسسة.", icon: UsersRound, stat: "96.4% معدل الحضور", action: "إضافة موظف" },
  reports: { eyebrow: "التحليلات", title: "تقارير تصنع القرار", detail: "استخدم فلاتر زمنية ورسومات قابلة للتصدير ضمن نطاق البيانات المصرح به.", icon: FileBarChart2, stat: "12 تقريراً محفوظاً", action: "إنشاء تقرير" },
  settings: { eyebrow: "الإعدادات", title: "الحوكمة والصلاحيات", detail: "تحكم بالمؤسسة والوحدات والأدوار مع سجل تدقيق قابل للمراجعة.", icon: Settings2, stat: "7 وحدات ضمن الاشتراك", action: "إدارة الأدوار" },
};

function NawaMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(217,180,107,.2)]">
        <span className="latin text-lg font-extrabold">N</span>
        <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-tl-xl bg-[#20394b]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="latin text-base font-extrabold tracking-[.16em] text-white">NAWA</div>
          <div className="mt-1 text-[9px] font-medium tracking-[.2em] text-[#b6a77e]">BUSINESS OS</div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ children, tone }: { children: string; tone: string }) {
  const style = {
    green: "border-emerald-400/15 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-300/15 bg-amber-300/10 text-amber-200",
    red: "border-rose-400/15 bg-rose-400/10 text-rose-300",
    blue: "border-sky-300/15 bg-sky-300/10 text-sky-200",
  }[tone] ?? "border-white/10 bg-white/5 text-slate-300";
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", style)}>{children}</span>;
}

function MetricCard({ label, value, trend, icon: Icon, tone }: { label: string; value: number; trend: string; icon: typeof TrendingUp; tone: "gold" | "blue" | "green" | "rose" }) {
  const { formatCurrency } = useLanguage();
  const tones = {
    gold: "bg-[#d9b46b]/10 text-[#e4c684] ring-[#d9b46b]/20",
    blue: "bg-[#60a8e6]/10 text-[#90c7f0] ring-[#60a8e6]/20",
    green: "bg-[#45b69a]/10 text-[#71d4b8] ring-[#45b69a]/20",
    rose: "bg-[#ec7180]/10 text-[#f2a5ad] ring-[#ec7180]/20",
  }[tone];
  return (
    <article className="surface group relative overflow-hidden rounded-3xl border p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("grid h-11 w-11 place-items-center rounded-2xl ring-1", tones)}><Icon className="h-5 w-5" /></div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300"><TrendingUp className="h-3 w-3" />{trend}</span>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white">{formatCurrency(value)}</p>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-l from-transparent via-white/10 to-transparent" />
    </article>
  );
}

function DashboardContent({ onOpenModule }: { onOpenModule: (key: SectionKey) => void }) {
  const { t, formatCurrency } = useLanguage();
  return (
    <div className="enter space-y-6">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary"><Sparkles className="h-4 w-4" />مرحباً بك، فريق النواة</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">نبض مؤسستك في مكان واحد</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">راقب الأداء، عالج التنبيهات، وانتقل مباشرة إلى ما يحتاج قرارك اليوم.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => toast.success(t("saved"))} className="gap-2 rounded-xl bg-primary px-4 text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />فاتورة جديدة</Button>
          <Button variant="outline" onClick={() => onOpenModule("reports")} className="gap-2 rounded-xl border-white/10 bg-white/[.03] text-slate-200 hover:bg-white/[.07]"><FileBarChart2 className="h-4 w-4" />عرض التقارير</Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("totalSalesMetric")} value={154280} trend="12.6%" icon={CircleDollarSign} tone="gold" />
        <MetricCard label={t("netRevenueMetric")} value={48920} trend="8.4%" icon={WalletCards} tone="blue" />
        <MetricCard label={t("inventoryValueMetric")} value={286740} trend="3.2%" icon={Package} tone="green" />
        <MetricCard label={t("dueInvoicesMetric")} value={18320} trend="-4.1%" icon={ReceiptText} tone="rose" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.9fr)]">
        <article className="surface grid-line rounded-3xl border p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-semibold text-white">اتجاه المبيعات</p><p className="mt-1 text-xs text-muted-foreground">تحديث أسبوعي — <span className="text-primary">عرض معاينة للواجهة</span></p></div>
            <button onClick={() => toast.info("يمكن تعديل الفترة من واجهة التقارير.")} className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[.03] px-3 py-2 text-xs text-slate-300 hover:bg-white/[.07]">هذا العام<ChevronDown className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-4 h-[280px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="nawaSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d9b46b" stopOpacity={0.38} /><stop offset="95%" stopColor="#d9b46b" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#ffffff" strokeOpacity={0.06} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: "#8d96a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8d96a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: "#d9b46b", strokeOpacity: 0.28 }} contentStyle={{ background: "#171c27", border: "1px solid #394153", borderRadius: 14, color: "#f7f1e7", direction: "rtl" }} formatter={(value: number) => [formatCurrency(value * 1000), t("totalSalesMetric")]} />
                <Area type="monotone" dataKey="value" stroke="#d9b46b" strokeWidth={3} fill="url(#nawaSales)" activeDot={{ r: 5, fill: "#f4db9d", stroke: "#18202c", strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="surface rounded-3xl border p-5 md:p-6">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">صحة المخزون</p><p className="mt-1 text-xs text-muted-foreground">توزيع الأصناف حسب الحالة</p></div><button onClick={() => onOpenModule("inventory")} className="text-xs text-primary hover:text-[#f1d391]">التفاصيل</button></div>
          <div className="mt-5 h-[180px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={inventoryData} layout="vertical" margin={{ left: -22, right: 18 }}><XAxis type="number" hide /><YAxis type="category" dataKey="label" width={55} tick={{ fill: "#a7afbe", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#ffffff09" }} contentStyle={{ background: "#171c27", border: "1px solid #394153", borderRadius: 12 }} /><Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>{inventoryData.map(item => <Cell key={item.label} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-4"><div className="rounded-2xl bg-white/[.035] p-3"><p className="text-[11px] text-muted-foreground">أصناف منخفضة</p><p className="latin mt-1 text-lg font-bold text-[#f2a46c]">14</p></div><div className="rounded-2xl bg-white/[.035] p-3"><p className="text-[11px] text-muted-foreground">حركات اليوم</p><p className="latin mt-1 text-lg font-bold text-white">218</p></div></div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.85fr)]">
        <article className="surface overflow-hidden rounded-3xl border">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-5"><div><p className="text-sm font-semibold text-white">الفواتير الأخيرة</p><p className="mt-1 text-xs text-muted-foreground">آخر الحركة التجارية المسجلة</p></div><button onClick={() => onOpenModule("sales")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-[#f4d58e]">عرض الكل<ChevronLeft className="h-3.5 w-3.5" /></button></div>
          <div className="thin-scrollbar overflow-x-auto"><table className="w-full min-w-[620px] text-right"><thead className="bg-white/[.025] text-[11px] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">رقم الفاتورة</th><th className="px-5 py-3 font-medium">العميل</th><th className="px-5 py-3 font-medium">القيمة</th><th className="px-5 py-3 font-medium">الحالة</th><th className="px-5 py-3" /></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.no} className="border-t border-white/[.055] transition-colors hover:bg-white/[.025]"><td className="latin px-5 py-4 text-xs font-semibold text-slate-200">{invoice.no}</td><td className="px-5 py-4 text-sm text-white">{invoice.customer}</td><td className="px-5 py-4 text-sm text-slate-300">{invoice.value}</td><td className="px-5 py-4"><StatusPill tone={invoice.tone}>{invoice.status}</StatusPill></td><td className="px-5 py-4"><button className="text-muted-foreground hover:text-white" aria-label="خيارات الفاتورة"><MoreHorizontal className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
        </article>

        <article className="surface rounded-3xl border p-5">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">تنبيهات تحتاج قراراً</p><p className="mt-1 text-xs text-muted-foreground">أولوية اليوم</p></div><Bell className="h-4 w-4 text-primary" /></div>
          <div className="mt-5 space-y-3">
            {[{ icon: Package, title: "مستوى مخزون حرج", detail: "سكر أبيض فاخر — 75 وحدة", tone: "red" }, { icon: ReceiptText, title: "فاتورة مستحقة", detail: "مؤسسة الربيع — 8,720 ر.س", tone: "amber" }, { icon: Truck, title: "طلب استلام اليوم", detail: "أمر شراء PO-1843", tone: "blue" }].map(item => <button key={item.title} onClick={() => toast.info(`تم فتح: ${item.title}`)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[.06] bg-white/[.025] p-3 text-right transition-colors hover:bg-white/[.06]"><div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", item.tone === "red" ? "bg-rose-400/10 text-rose-300" : item.tone === "amber" ? "bg-amber-300/10 text-amber-200" : "bg-sky-300/10 text-sky-200")}><item.icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-100">{item.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{item.detail}</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>)}
          </div>
        </article>
      </section>
    </div>
  );
}

function ModuleView({ section, onBack }: { section: Exclude<SectionKey, "dashboard">; onBack: () => void }) {
  const info = sectionCopy[section];
  const Icon = info.icon;
  const rows = section === "inventory" ? products : section === "sales" ? invoices.map(i => ({ name: i.customer, sku: i.no, stock: i.value, status: i.status, tone: i.tone })) : products.map((p, index) => ({ ...p, name: ["عملية تشغيلية", "سجل مراجع", "طلب قيد المعالجة", "تقرير دوري"][index], sku: ["اليوم", "أمس", "هذا الأسبوع", "هذا الشهر"][index] }));
  return <div className="enter space-y-6"><section className="surface relative overflow-hidden rounded-3xl border p-6 md:p-8"><div className="absolute -left-14 -top-14 h-48 w-48 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Icon className="h-6 w-6" /></div><div><p className="text-sm text-primary">{info.eyebrow}</p><h1 className="mt-1 text-2xl font-bold text-white">{info.title}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{info.detail}</p></div></div><div className="flex items-center gap-2"><Button variant="outline" onClick={onBack} className="rounded-xl border-white/10 bg-white/[.03] text-slate-200">العودة للوحة</Button><Button onClick={() => toast.success(`تم فتح نموذج: ${info.action}`)} className="gap-2 rounded-xl bg-primary text-primary-foreground"><Plus className="h-4 w-4" />{info.action}</Button></div></div></section><section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_330px]"><article className="surface overflow-hidden rounded-3xl border"><div className="flex items-center justify-between border-b border-white/8 px-5 py-5"><div><p className="text-sm font-semibold text-white">آخر السجلات</p><p className="mt-1 text-xs text-muted-foreground">عرض تجريبي لواجهة {info.eyebrow}</p></div><Button variant="outline" onClick={() => toast.info("تم تطبيق الفلتر الافتراضي.")} className="h-9 rounded-xl border-white/10 bg-white/[.03] text-xs text-slate-300">تصفية</Button></div><div className="thin-scrollbar overflow-x-auto"><table className="w-full min-w-[600px] text-right"><thead className="bg-white/[.025] text-[11px] text-muted-foreground"><tr><th className="px-5 py-3 font-medium">العنصر</th><th className="px-5 py-3 font-medium">المرجع</th><th className="px-5 py-3 font-medium">القيمة / الكمية</th><th className="px-5 py-3 font-medium">الحالة</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.name}-${index}`} className="border-t border-white/[.055] hover:bg-white/[.025]"><td className="px-5 py-4 text-sm text-white">{row.name}</td><td className="latin px-5 py-4 text-xs text-muted-foreground">{row.sku}</td><td className="px-5 py-4 text-sm text-slate-300">{row.stock}</td><td className="px-5 py-4"><StatusPill tone={row.tone}>{row.status}</StatusPill></td></tr>)}</tbody></table></div></article><article className="surface rounded-3xl border p-5"><p className="text-sm font-semibold text-white">ملخص سريع</p><div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.07] p-4"><p className="text-xs text-primary">مؤشر الوحدة</p><p className="mt-2 text-lg font-bold text-white">{info.stat}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">ستظهر الأرقام الفعلية هنا من بيانات المؤسسة بعد الدخول وربط الوحدة بسياق الاشتراك.</p></div><button onClick={() => toast.info("يمكن تخصيص هذه المساحة لكل دور وظيفي.")} className="mt-5 flex w-full items-center justify-between rounded-2xl bg-white/[.04] p-4 text-sm text-slate-200 hover:bg-white/[.07]"><span>تخصيص لوحة الوحدة</span><Settings2 className="h-4 w-4 text-primary" /></button></article></section></div>;
}

export default function Home() {
  const [section, setSection] = useState<SectionKey>("dashboard");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const changeSection = (key: SectionKey) => { setSection(key); setSidebarOpen(false); };
  const submitAssistant = () => {
    if (!query.trim()) return toast.error("اكتب استفسارك أولاً.");
    toast.success("تمت إضافة الاستفسار إلى سياق المؤسسة التجريبي.");
    setQuery("");
  };

  return (
    <div className="app-shell text-right" dir="rtl">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_0%,rgba(89,143,178,.08),transparent_28rem)]" />
      <aside className={cn("fixed inset-y-0 right-0 z-40 flex w-[278px] flex-col border-l border-white/[.07] bg-[#10141d]/95 p-4 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0", isSidebarOpen ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-2 pt-2"><NawaMark /><button onClick={() => setSidebarOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-white/[.05] lg:hidden"><X className="h-5 w-5" /></button></div>
        <div className="mt-8 px-2"><p className="text-[10px] font-semibold tracking-[.18em] text-[#777f90]">القائمة الرئيسية</p></div>
        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto thin-scrollbar">{navItems.map(item => { const Icon = item.icon; const active = item.key === section; return <button key={item.key} onClick={() => changeSection(item.key)} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all", active ? "bg-primary text-primary-foreground shadow-[0_12px_22px_rgba(217,180,107,.12)]" : "text-[#afb7c4] hover:bg-white/[.045] hover:text-white")}><Icon className={cn("h-[18px] w-[18px]", active ? "" : "text-[#7e899b] group-hover:text-primary")} /><span className="flex-1 text-right font-medium">{item.label}</span>{item.module === "reports" && <span className={cn("rounded-md px-1.5 py-0.5 text-[9px]", active ? "bg-black/10" : "bg-primary/10 text-primary")}>جديد</span>}</button>})}</nav>
        <div className="mt-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[.12] to-primary/[.025] p-4"><div className="flex items-center gap-2 text-primary"><Zap className="h-4 w-4" /><p className="text-xs font-bold">ذكاء أعمال مدمج</p></div><p className="mt-2 text-[11px] leading-6 text-[#b4b9c4]">اطلب تقريراً أو اسأل عن أداء مؤسستك بلغة طبيعية.</p><button onClick={() => setAssistantOpen(true)} className="mt-3 text-xs font-semibold text-[#e8c87f] hover:text-[#f5dc9e]">ابدأ المحادثة ←</button></div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3"><Avatar className="h-9 w-9 border border-primary/20"><AvatarFallback className="bg-primary/10 text-xs text-primary">ن</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">فريق النواة</p><p className="mt-1 text-[10px] text-muted-foreground">مدير المؤسسة</p></div><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></div>
      </aside>

      {isSidebarOpen && <button className="fixed inset-0 z-30 bg-black/45 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة" />}
      <main className="min-h-screen lg:mr-[278px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center gap-3 border-b border-white/[.06] bg-[#10141d]/72 px-4 backdrop-blur-xl md:px-7"><button onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.07] lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="بحث" placeholder="ابحث عن فاتورة، عميل، منتج..." className="w-full max-w-lg bg-transparent text-sm text-white outline-none placeholder:text-[#778092]" /></div><div className="flex flex-1 items-center gap-2 sm:flex-none"><button onClick={() => setLocation("/workspace")} className="hidden h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/[.08] px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/[.14] md:flex"><ShieldCheck className="h-4 w-4" />مساحة العمل</button><div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2"><Building2 className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-xs font-semibold text-slate-200">مؤسسة نواة التجارية</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></div><button onClick={() => toast.info("لا توجد إشعارات غير مقروءة في المعاينة.")} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/[.08] bg-white/[.035] text-slate-300 hover:bg-white/[.07]" aria-label="الإشعارات"><Bell className="h-[18px] w-[18px]" /><span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></button><button onClick={() => toast.info("تتغير الواجهة تلقائياً وفق الدور والصلاحيات.")} className="hidden h-10 w-10 place-items-center rounded-xl border border-white/[.08] bg-white/[.035] text-slate-300 hover:bg-white/[.07] sm:grid" aria-label="المساعدة"><HelpCircle className="h-[18px] w-[18px]" /></button></div></header>

        <div className="mx-auto max-w-[1600px] p-4 md:p-7">{section === "dashboard" ? <DashboardContent onOpenModule={changeSection} /> : <ModuleView section={section} onBack={() => changeSection("dashboard")} />}</div>
      </main>

      <button onClick={() => setAssistantOpen(true)} className="fixed bottom-5 left-5 z-20 flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_15px_38px_rgba(217,180,107,.25)] transition-transform active:scale-[.97]"><Bot className="h-5 w-5" />مساعد نواة</button>
      {assistantOpen && <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-4 sm:place-items-center"><section className="surface enter w-full max-w-xl rounded-3xl border p-5 shadow-2xl"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div><div><p className="text-sm font-bold text-white">مساعد نواة الذكي</p><p className="mt-1 text-[11px] text-muted-foreground">يعمل ضمن سياق المؤسسة والصلاحيات</p></div></div><button onClick={() => setAssistantOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-white/[.05]"><X className="h-5 w-5" /></button></div><div className="mt-5 rounded-2xl border border-primary/12 bg-primary/[.055] p-4"><p className="text-sm leading-7 text-slate-200">مرحباً. يمكنني تلخيص مؤشرات المؤسسة أو اقتراح أولويات تشغيلية عند ربط حسابك بالبيانات الفعلية.</p></div><div className="mt-5 flex gap-2"><Input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitAssistant(); }} placeholder="مثال: ما أهم تنبيهات المخزون؟" className="h-12 rounded-xl border-white/10 bg-white/[.035] text-right text-sm placeholder:text-muted-foreground" /><Button onClick={submitAssistant} className="h-12 rounded-xl bg-primary px-4 text-primary-foreground"><ArrowUpLeft className="h-4 w-4" /></Button></div><p className="mt-3 text-[10px] leading-5 text-muted-foreground">المعاينة لا ترسل بيانات. في مساحة العمل الموثقة، يمر الطلب عبر حارس المؤسسة والوحدة قبل المعالجة.</p></section></div>}
    </div>
  );
}
