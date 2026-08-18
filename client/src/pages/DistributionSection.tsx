import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatOperationalStatus } from "@/lib/operationalStatus";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ChevronLeft, Loader2, MapPinned, RefreshCw, Route, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type DistributionSection = "routes" | "vehicles" | "territories" | "compliance";

const meta: Record<DistributionSection, { ar: string; fr: string; en: string; description: { ar: string; fr: string; en: string }; icon: typeof Route }> = {
  routes: { ar: "الجولات والتسليم", fr: "Tournées et livraisons", en: "Routes & delivery", description: { ar: "جدول متابعة الجولات وحالات تنفيذها وتواريخها.", fr: "Tableau de suivi des tournées, statuts et dates.", en: "Track route numbers, execution states, and dates." }, icon: Route },
  vehicles: { ar: "المركبات والأسطول", fr: "Véhicules et flotte", en: "Vehicles & fleet", description: { ar: "جدول أسطول المؤسسة وسعات المركبات وحالاتها.", fr: "Tableau de flotte, capacités et statuts des véhicules.", en: "Track organization vehicles, capacity, and states." }, icon: Truck },
  territories: { ar: "نطاقات التوزيع", fr: "Zones de distribution", en: "Distribution territories", description: { ar: "جدول مناطق التغطية ونقاط الخدمة المعتمدة.", fr: "Tableau des zones de couverture et points de service.", en: "Track approved coverage areas and service points." }, icon: MapPinned },
  compliance: { ar: "تنبيهات المركبات", fr: "Alertes véhicules", en: "Vehicle alerts", description: { ar: "متابعة التأمين والمراقبة التقنية القريبة من الانتهاء.", fr: "Suivi des assurances et contrôles techniques à échéance.", en: "Track insurance and technical inspection expiry alerts." }, icon: AlertTriangle },
};

const tone: Record<string, string> = { active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300", closed: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300", planned: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300", started: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300", in_progress: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300", maintenance: "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300", expired: "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300", critical: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300" };

export default function DistributionSectionPage() {
  const { language, direction, formatDate, formatNumber, t } = useLanguage();
  const [location, setLocation] = useLocation();
  const section = (location.split("/").pop() || "routes") as DistributionSection;
  const sectionMeta = meta[section] ?? meta.routes;
  const Icon = sectionMeta.icon;
  const [search, setSearch] = useState("");
  const routes = trpc.erp.distribution.routes.list.useQuery();
  const vehicles = trpc.erp.distribution.vehicles.list.useQuery();
  const territories = trpc.erp.distribution.territories.list.useQuery();
  const alerts = trpc.erp.distribution.vehicles.documentAlerts.useQuery();
  const query = section === "routes" ? routes : section === "vehicles" ? vehicles : section === "territories" ? territories : alerts;
  const rows = useMemo(() => {
    const all = query.data ?? [];
    const needle = search.trim().toLocaleLowerCase();
    return needle ? all.filter((row: any) => Object.values(row).some(value => String(value ?? "").toLocaleLowerCase().includes(needle))) : all;
  }, [query.data, search]);
  const copy = language === "ar" ? { search: "ابحث في الجدول", refresh: "تحديث البيانات", back: "فتح مركز العمليات", count: "سجل", empty: "لا توجد بيانات مطابقة.", code: "الرمز", date: "التاريخ", status: "الحالة", registration: "التسجيل", type: "النوع", payload: "الحمولة", name: "الاسم", location: "الموقع", document: "الوثيقة", expiry: "الانتهاء" } : language === "fr" ? { search: "Rechercher dans le tableau", refresh: "Actualiser", back: "Ouvrir le centre opérationnel", count: "lignes", empty: "Aucune donnée correspondante.", code: "Code", date: "Date", status: "Statut", registration: "Immatriculation", type: "Type", payload: "Charge", name: "Nom", location: "Position", document: "Document", expiry: "Échéance" } : { search: "Search this table", refresh: "Refresh data", back: "Open operations center", count: "rows", empty: "No matching data.", code: "Code", date: "Date", status: "Status", registration: "Registration", type: "Type", payload: "Payload", name: "Name", location: "Location", document: "Document", expiry: "Expiry" };
  const badge = (status: string) => <Badge variant="outline" className={tone[status] ?? ""}>{formatOperationalStatus(language, status)}</Badge>;
  const table = () => {
    if (query.isLoading) return <div className="grid min-h-72 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
    if (query.isError) return <div className="grid min-h-72 place-items-center gap-3"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{copy.refresh}</Button></div>;
    if (!rows.length) return <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">{copy.empty}</div>;
    if (section === "routes") return <table className="w-full min-w-[660px] text-sm"><thead><tr className="border-b bg-muted/30 text-start text-xs text-muted-foreground"><th className="p-4">{copy.code}</th><th className="p-4">{copy.date}</th><th className="p-4">{copy.status}</th></tr></thead><tbody>{rows.map((route: any) => <tr key={route.id} className="border-b border-border/60 hover:bg-muted/20"><td className="p-4 font-mono text-xs">{route.routeNumber}</td><td className="p-4">{formatDate(route.routeDate)}</td><td className="p-4">{badge(route.status)}</td></tr>)}</tbody></table>;
    if (section === "vehicles") return <table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b bg-muted/30 text-start text-xs text-muted-foreground"><th className="p-4">{copy.code}</th><th className="p-4">{copy.registration}</th><th className="p-4">{copy.type}</th><th className="p-4">{copy.payload}</th><th className="p-4">{copy.status}</th></tr></thead><tbody>{rows.map((vehicle: any) => <tr key={vehicle.id} className="border-b border-border/60 hover:bg-muted/20"><td className="p-4 font-mono text-xs">{vehicle.code}</td><td className="p-4">{vehicle.registrationNumber}</td><td className="p-4">{vehicle.type}</td><td className="p-4">{formatNumber(Number(vehicle.maximumPayloadWeight))}</td><td className="p-4">{badge(vehicle.status)}</td></tr>)}</tbody></table>;
    if (section === "territories") return <table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b bg-muted/30 text-start text-xs text-muted-foreground"><th className="p-4">{copy.code}</th><th className="p-4">{copy.name}</th><th className="p-4">{copy.location}</th></tr></thead><tbody>{rows.map((territory: any) => <tr key={territory.id} className="border-b border-border/60 hover:bg-muted/20"><td className="p-4 font-mono text-xs">{territory.code}</td><td className="p-4 font-medium">{territory.name}</td><td className="p-4">{territory.latitude && territory.longitude ? `${territory.latitude}, ${territory.longitude}` : "—"}</td></tr>)}</tbody></table>;
    return <table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b bg-muted/30 text-start text-xs text-muted-foreground"><th className="p-4">{copy.code}</th><th className="p-4">{copy.document}</th><th className="p-4">{copy.expiry}</th><th className="p-4">{copy.status}</th></tr></thead><tbody>{rows.map((alert: any) => <tr key={alert.id} className="border-b border-border/60 hover:bg-muted/20"><td className="p-4 font-mono text-xs">{alert.vehicleCode}</td><td className="p-4">{alert.documentType === "insurance" ? (language === "ar" ? "التأمين" : language === "fr" ? "Assurance" : "Insurance") : (language === "ar" ? "المراقبة التقنية" : language === "fr" ? "Contrôle technique" : "Technical inspection")}</td><td className="p-4">{formatDate(alert.expiresAt)}</td><td className="p-4">{badge(alert.alertLevel)}</td></tr>)}</tbody></table>;
  };
  return <DashboardLayout><main dir={direction} className="mx-auto max-w-7xl space-y-6"><header className="surface flex flex-col gap-5 rounded-3xl border p-6 md:flex-row md:items-end md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div><div><p className="text-sm text-primary">{language === "ar" ? "التوزيع والأسطول" : language === "fr" ? "Distribution et flotte" : "Distribution & fleet"}</p><h1 className="mt-1 text-2xl font-bold text-foreground">{sectionMeta[language]}</h1><p className="mt-2 text-sm leading-7 text-muted-foreground">{sectionMeta.description[language]}</p></div></div><Button variant="outline" onClick={() => setLocation("/distribution")}><ChevronLeft className="me-2 h-4 w-4" />{copy.back}</Button></header><section className="surface overflow-hidden rounded-3xl border"><div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-foreground">{sectionMeta[language]}</p><p className="mt-1 text-xs text-muted-foreground">{rows.length} {copy.count}</p></div><div className="flex gap-2"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} className="h-10 w-full sm:w-64" /><Button variant="outline" size="icon" aria-label={copy.refresh} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" /></Button></div></div><p className="border-b border-border/70 bg-muted/20 px-4 py-2 text-center text-xs text-muted-foreground sm:hidden">{language === "ar" ? "اسحب أفقياً لرؤية جميع الأعمدة" : language === "fr" ? "Faites glisser pour voir toutes les colonnes" : "Swipe to view all columns"}</p><div className="overflow-x-auto">{table()}</div></section></main></DashboardLayout>;
}
