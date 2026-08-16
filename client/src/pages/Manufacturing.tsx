import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { manufacturingCenterCopy } from "@/i18n/translations";
import { trpc } from "@/lib/trpc";
import { Boxes, CircleDollarSign, Factory, FlaskConical, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

const statusKey = (status: string) => ({ draft: "draft", planned: "planned", approved: "approved", materials_reserved: "materialsReserved", in_production: "activeProduction", quality_hold: "qualityHoldStatus", completed: "completedStatus", closed: "closed", cancelled: "cancelled" }[status] ?? "draft") as keyof typeof manufacturingCenterCopy.ar;

export default function Manufacturing() {
  const { language, direction, t } = useLanguage();
  const copy = manufacturingCenterCopy[language];
  const [section, setSection] = useState("overview");
  const overview = trpc.erp.manufacturing.overview.useQuery();
  const orders = trpc.erp.manufacturing.orders.useQuery();
  const refresh = () => { void overview.refetch(); void orders.refetch(); };
  const isLoading = overview.isLoading || orders.isLoading;
  const metrics = [
    { label: copy.planning, value: overview.data?.planned ?? 0, icon: Factory, tone: "text-primary" },
    { label: copy.inProduction, value: overview.data?.inProduction ?? 0, icon: Boxes, tone: "text-sky-500" },
    { label: copy.qualityHold, value: overview.data?.qualityHold ?? 0, icon: FlaskConical, tone: "text-amber-500" },
    { label: copy.shortages, value: overview.data?.materialShortages ?? 0, icon: TriangleAlert, tone: "text-rose-500" },
  ];

  return <DashboardLayout><div className="space-y-5" dir={direction}>
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-background p-6 shadow-sm">
      <div className="absolute -top-16 -end-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2"><div className="flex items-center gap-2 text-primary"><Factory className="h-5 w-5" /><span className="text-sm font-medium">Nawa ERP</span></div><h1 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.title}</h1><p className="text-sm leading-6 text-muted-foreground">{copy.description}</p></div>
        <Button onClick={refresh} disabled={isLoading} className="gap-2 self-start lg:self-auto"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`} />{copy.refresh}</Button>
      </div>
    </section>

    {overview.isError || orders.isError ? <Card className="border-destructive/30"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">{copy.loadError}</p><Button variant="outline" size="sm" onClick={refresh}>{copy.retry}</Button></CardContent></Card> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon, tone }) => <Card key={label} className="transition-transform duration-200 hover:-translate-y-0.5"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs text-muted-foreground">{label}</p>{isLoading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>}</div><div className={`rounded-xl bg-muted p-3 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><Card><CardHeader className="pb-3"><CardTitle className="text-base">{copy.operationalView}</CardTitle><CardDescription>{copy.dataScope}</CardDescription></CardHeader><CardContent><Tabs value={section} onValueChange={setSection}><TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-muted/70 p-1 md:grid-cols-8"><TabsTrigger value="overview">{copy.orderList}</TabsTrigger><TabsTrigger value="materials">{copy.rawMaterials}</TabsTrigger><TabsTrigger value="stages">{copy.stages}</TabsTrigger><TabsTrigger value="consumption">{copy.consumption}</TabsTrigger><TabsTrigger value="output">{copy.output}</TabsTrigger><TabsTrigger value="quality">{copy.quality}</TabsTrigger><TabsTrigger value="costs">{copy.costs}</TabsTrigger><TabsTrigger value="traceability">{copy.traceability}</TabsTrigger></TabsList><div className="mt-5 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">{section === "overview" ? copy.orderList : `${copy[section as keyof typeof copy]} — ${copy.dataScope}`}</div></Tabs></CardContent></Card>
      <Card className="bg-card"><CardHeader className="pb-2"><CardTitle className="text-base">{copy.completed}</CardTitle><CardDescription>{copy.goodOutput} · {copy.waste} · {copy.averageUnitCost}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-3"><div><p className="text-xs text-muted-foreground">{copy.goodOutput}</p><p className="mt-1 font-semibold tabular-nums">{overview.data?.goodOutputQuantity ?? 0}</p></div><div><p className="text-xs text-muted-foreground">{copy.waste}</p><p className="mt-1 font-semibold tabular-nums">{overview.data?.wasteQuantity ?? 0}</p></div><div><p className="text-xs text-muted-foreground">{copy.averageUnitCost}</p><p className="mt-1 font-semibold tabular-nums">{overview.data?.averageUnitCost ?? 0}</p></div></div><div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />{copy.dataScope}</div></CardContent></Card></section>

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">{copy.orderList}</CardTitle></CardHeader><CardContent>{isLoading ? <div className="space-y-2">{[1, 2, 3].map(item => <Skeleton key={item} className="h-12 w-full" />)}</div> : orders.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3 text-start">{copy.order}</th><th className="p-3 text-start">{copy.plannedQuantity}</th><th className="p-3 text-start">{t("status")}</th><th className="p-3 text-start">{copy.quality}</th></tr></thead><tbody>{orders.data.map(order => <tr key={order.id} className="border-b last:border-0"><td className="p-3 font-medium">{order.orderNumber}</td><td className="p-3 tabular-nums">{order.plannedQuantity} {order.plannedUnit}</td><td className="p-3"><Badge variant="outline">{copy[statusKey(order.status)]}</Badge></td><td className="p-3 text-muted-foreground">{order.status === "quality_hold" ? copy.qualityHold : "—"}</td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{copy.noOrders}</div>}</CardContent></Card>
  </div></DashboardLayout>;
}
