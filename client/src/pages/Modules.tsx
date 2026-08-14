import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Boxes, Factory, LockKeyhole, Package, Route, ShieldCheck, Sparkles, WalletCards, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const modules = [
  { key: "inventory", title: "commerce", icon: Package, accent: "from-amber-300/20 to-amber-300/[.02]", entitlement: ["inventory", "sales", "purchases"] },
  { key: "distribution", title: "distribution", icon: Route, accent: "from-sky-300/20 to-sky-300/[.02]", entitlement: ["distribution"] },
  { key: "manufacturing", title: "manufacturing", icon: Factory, accent: "from-violet-300/20 to-violet-300/[.02]", entitlement: ["manufacturing"] },
  { key: "finance", title: "finance", icon: WalletCards, accent: "from-emerald-300/20 to-emerald-300/[.02]", entitlement: ["finance"] },
  { key: "hr", title: "hr", icon: UsersRound, accent: "from-rose-300/20 to-rose-300/[.02]", entitlement: ["hr"] },
] as const;

const titles = {
  ar: { commerce: "التجارة والمخزون", distribution: "التوزيع والأسطول", manufacturing: "التصنيع والإنتاج", finance: "المالية والمحاسبة", hr: "الموارد البشرية" },
  fr: { commerce: "Commerce et stocks", distribution: "Distribution et flotte", manufacturing: "Fabrication et production", finance: "Finance et comptabilité", hr: "Ressources humaines" },
  en: { commerce: "Commerce & inventory", distribution: "Distribution & fleet", manufacturing: "Manufacturing & production", finance: "Finance & accounting", hr: "Human resources" },
} as const;

export default function ModulesPage() {
  const { language, t } = useLanguage();
  const bootstrap = trpc.erp.bootstrap.useQuery();
  const [, setLocation] = useLocation();
  const activeKeys = new Set(bootstrap.data?.modules.filter(item => item.status === "active").map(item => item.key) ?? []);

  return <DashboardLayout><main className="mx-auto max-w-7xl space-y-7" dir={language === "ar" ? "rtl" : "ltr"}><section className="surface relative overflow-hidden rounded-3xl border p-7 md:p-9"><div className="absolute -left-12 -top-16 h-60 w-60 rounded-full bg-primary/10 blur-3xl" /><div className="relative"><div className="flex items-center gap-2 text-primary"><Boxes className="h-4 w-4" /><p className="text-sm font-semibold">{t("moduleHub")}</p></div><h1 className="mt-3 text-3xl font-bold text-white">{language === "ar" ? "اختر المساحة التي تقود أعمالك" : language === "fr" ? "Choisissez l’espace qui pilote votre activité" : "Choose the space that drives your business"}</h1><p className="mt-3 max-w-3xl text-sm leading-8 text-muted-foreground">{language === "ar" ? "تظهر جميع الوحدات المتاحة لخطة مؤسستك، بينما تبقى الوحدات غير المشترك بها في وضع معاينة آمن من دون وصول إلى بيانات أو إجراءات تشغيلية." : language === "fr" ? "Tous les modules sont visibles. Les modules non inclus restent dans un aperçu sécurisé, sans accès aux données ni aux opérations." : "All modules remain visible. Modules outside your plan stay in a secure preview with no data or operational access."}</p></div></section><section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{modules.map(module => { const active = module.entitlement.some(key => activeKeys.has(key)); const Icon = module.icon; return <article key={module.key} className="surface group relative overflow-hidden rounded-3xl border p-6"><div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${module.accent}`} /><div className="relative"><div className="flex items-start justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[.07] text-primary ring-1 ring-white/10"><Icon className="h-6 w-6" /></div>{active ? <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />{t("active")}</span> : <span className="flex items-center gap-1 rounded-full bg-white/[.06] px-2.5 py-1 text-[11px] font-semibold text-slate-300"><LockKeyhole className="h-3.5 w-3.5" />{t("locked")}</span>}</div><p className="mt-10 text-xs font-semibold text-primary">{t("premiumModule")}</p><h2 className="mt-2 text-xl font-bold text-white">{titles[language][module.title]}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{active ? (language === "ar" ? "الوحدة مفعلة في اشتراك مؤسستك ويمكنك الانتقال إلى مساحة العمل لإدارة سجلاتها." : language === "fr" ? "Ce module est actif dans votre abonnement et prêt pour les opérations." : "This module is active in your subscription and ready for operations.") : t("noAccess")}</p><div className="mt-6">{active ? <Button onClick={() => setLocation("/workspace")} className="rounded-xl bg-primary text-primary-foreground">{t("workspace")}</Button> : <Button variant="outline" onClick={() => toast.info(language === "ar" ? "تم فتح مسار طلب الترقية لمسؤول المؤسسة." : language === "fr" ? "La demande de mise à niveau est prête pour l’administrateur." : "The upgrade request path is ready for your administrator.")} className="gap-2 rounded-xl border-white/10 bg-white/[.03] text-slate-200"><Sparkles className="h-4 w-4" />{t("explore")}</Button>}</div></div></article>})}</section></main></DashboardLayout>;
}
