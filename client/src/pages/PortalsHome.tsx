import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nawaPortals, type NawaPortal } from "@/config/nawaPortals";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Grid2X2, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const copy = {
  ar: { eyebrow: "بوابات نواة", title: "اختر بوابتك للعمل", description: "تنظيم واضح للوحدات الحالية حسب المجال، مع إبقاء الوصول محكوماً بالاشتراك والصلاحيات.", active: "متاحة", locked: "غير مفعلة", guarded: "الحماية الخادمية فعالة", open: "فتح البوابة", explore: "استكشاف", executive: "الملخص التنفيذي", loading: "يتم تجهيز بوابات المؤسسة…", unavailable: "هذه البوابة غير مفعلة لاشتراك المؤسسة الحالي.", moduleCount: "وحدات فعالة" },
  fr: { eyebrow: "Portails Nawa", title: "Choisissez votre portail de travail", description: "Les modules existants sont organisés par domaine, tout en conservant les contrôles d’abonnement et d’autorisation.", active: "Disponible", locked: "Non activé", guarded: "Protection serveur active", open: "Ouvrir le portail", explore: "Explorer", executive: "Vue exécutive", loading: "Préparation des portails…", unavailable: "Ce portail n’est pas activé pour l’abonnement de l’organisation.", moduleCount: "Modules actifs" },
  en: { eyebrow: "Nawa Portals", title: "Choose your work portal", description: "Existing modules are organized by domain while subscription and permission guards remain in force.", active: "Available", locked: "Not activated", guarded: "Server protection active", open: "Open portal", explore: "Explore", executive: "Executive overview", loading: "Preparing organization portals…", unavailable: "This portal is not activated for the organization subscription.", moduleCount: "Active modules" },
} as const;

const accentClass = {
  gold: "from-primary/20 via-primary/5 to-transparent border-primary/25",
  sky: "from-sky-400/20 via-sky-400/5 to-transparent border-sky-400/20",
  violet: "from-violet-400/20 via-violet-400/5 to-transparent border-violet-400/20",
  emerald: "from-emerald-400/20 via-emerald-400/5 to-transparent border-emerald-400/20",
  rose: "from-rose-400/20 via-rose-400/5 to-transparent border-rose-400/20",
  amber: "from-amber-400/20 via-amber-400/5 to-transparent border-amber-400/20",
  cyan: "from-cyan-400/20 via-cyan-400/5 to-transparent border-cyan-400/20",
  slate: "from-slate-300/20 via-slate-300/5 to-transparent border-slate-300/20",
} as const;

function PortalCard({ portal, active, onOpen }: { portal: NawaPortal; active: boolean; onOpen: () => void }) {
  const { language, direction } = useLanguage();
  const labels = copy[language];
  const Icon = portal.icon;
  return <article className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(0,0,0,.16)] motion-reduce:hover:transform-none ${accentClass[portal.accent]}`} dir={direction}>
    <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-white/[.05] blur-2xl" />
    <div className="relative flex h-full flex-col"><div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[.055] text-primary"><Icon className="h-5 w-5" /></div><Badge variant="outline" className={active ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[.05] text-slate-300"}>{active ? <ShieldCheck className="me-1 h-3.5 w-3.5" /> : <LockKeyhole className="me-1 h-3.5 w-3.5" />}{active ? labels.active : labels.locked}</Badge></div><h2 className="mt-7 text-lg font-bold text-white">{portal.name[language]}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{portal.description[language]}</p><div className="mt-auto flex items-center justify-between gap-3 pt-6"><span className="text-[11px] text-muted-foreground">{labels.guarded}</span><Button size="sm" variant={active ? "default" : "outline"} onClick={onOpen} className={active ? "rounded-xl bg-primary text-primary-foreground" : "rounded-xl border-white/10 bg-white/[.035] text-slate-200"}>{active ? labels.open : labels.explore}<ArrowLeft className={`ms-1 h-3.5 w-3.5 ${direction === "ltr" ? "rotate-180" : ""}`} /></Button></div></div>
  </article>;
}

export default function PortalsHome() {
  const { language, direction, t } = useLanguage();
  const labels = copy[language];
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false });
  const [, setLocation] = useLocation();
  const activeModuleKeys = new Set((bootstrap.data?.modules ?? []).filter(module => module.status === "active").map(module => module.key));
  const isPortalActive = (portal: NawaPortal) => portal.requiredModules.length === 0 || portal.requiredModules.some(key => activeModuleKeys.has(key));
  const openPortal = (portal: NawaPortal) => {
    if (!isPortalActive(portal)) {
      toast.info(labels.unavailable);
      return;
    }
    setLocation(portal.href);
  };

  return <DashboardLayout><main className="mx-auto max-w-[1500px] space-y-7" dir={direction}>{bootstrap.isLoading ? <div className="grid min-h-[55vh] place-items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" />{labels.loading}</div> : <><section className="surface relative overflow-hidden rounded-3xl border p-6 md:p-8"><div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="flex items-start gap-4"><div className="grid h-13 w-13 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Grid2X2 className="h-6 w-6" /></div><div><p className="text-sm font-semibold text-primary">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">{labels.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{labels.description}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/20 bg-primary/10 px-3 py-2 text-primary"><Sparkles className="me-1.5 h-4 w-4" />{activeModuleKeys.size} {labels.moduleCount}</Badge>{bootstrap.data?.membership.roleKey === "owner" ? <Button variant="outline" onClick={() => setLocation("/executive")} className="rounded-xl border-white/10 bg-white/[.035] text-slate-200">{labels.executive}</Button> : null}</div></div></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{nawaPortals.map(portal => <PortalCard key={portal.id} portal={portal} active={isPortalActive(portal)} onOpen={() => openPortal(portal)} />)}</section><p className="px-1 text-xs leading-6 text-muted-foreground">{t("organizationAccessStatus")}</p></>}</main></DashboardLayout>;
}
