import { Button } from "@/components/ui/button";
import CommerceInternalFlow from "@/components/CommerceInternalFlow";
import { useLanguage } from "@/contexts/LanguageContext";
import { getFlowNodeStatus, type FlowNodeConfig, type FlowNodeId, nawaFlowEdges, nawaFlowNodes } from "@/flow/nawaFlowConfig";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, LockKeyhole, Route, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type Subscription = { key: string; status: string };
export default function NawaFlow({ modules, restrictedNodeIds = [], onOpenClassic }: { modules: Subscription[]; restrictedNodeIds?: FlowNodeId[]; onOpenClassic: () => void }) {
  const { direction, t } = useLanguage();
  const [, setLocation] = useLocation();
  useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const selected = nawaFlowNodes.find(node => node.id === selectedId) ?? null;
  const isRtl = direction === "rtl";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const nodeMap = useMemo(() => new Map(nawaFlowNodes.map(node => [node.id, node])), []);

  const nodeStyle = (node: FlowNodeConfig) => ({
    insetInlineStart: `${node.position.x}%`,
    top: `${node.position.y}%`,
    transform: `translate(${isRtl ? "50%" : "-50%"}, -50%)`,
  });
  const edgePath = (source: FlowNodeConfig, target: FlowNodeConfig) => {
    const sx = isRtl ? 100 - source.position.x : source.position.x;
    const tx = isRtl ? 100 - target.position.x : target.position.x;
    const control = (sx + tx) / 2;
    return `M ${sx} ${source.position.y} C ${control} ${source.position.y}, ${control} ${target.position.y}, ${tx} ${target.position.y}`;
  };

  if (internalOpen) return <CommerceInternalFlow onBack={() => setInternalOpen(false)} onOpenCommerce={() => setLocation("/commerce")} />;

  return (
    <section className="space-y-5" dir={direction} aria-label={t("businessFlowMap")}>
      <header className="surface flex flex-col gap-4 rounded-3xl border p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20"><Route className="h-6 w-6" /></div><div><p className="text-sm font-semibold text-primary">{t("nawaFlow")}</p><h1 className="mt-1 text-2xl font-bold text-white">{t("businessFlowMap")}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{t("flowOverview")}</p></div></div>
        <Button variant="outline" onClick={onOpenClassic} className="gap-2 rounded-xl border-white/10 bg-white/[.03] text-slate-200 hover:bg-white/[.07]"><Arrow className="h-4 w-4" />{t("classic")}</Button>
      </header>

      <div className="surface overflow-hidden rounded-3xl border p-3 md:p-5">
        <div className="grid-line relative hidden min-h-[600px] overflow-hidden rounded-2xl border border-white/[.06] bg-[linear-gradient(135deg,rgba(217,180,107,.05),transparent_45%,rgba(76,143,188,.06))] md:block" role="application" aria-label={t("businessFlowMap")}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="nawa-flow-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" className="fill-primary" /></marker></defs>{nawaFlowEdges.map(edge => { const source = nodeMap.get(edge.source)!; const target = nodeMap.get(edge.target)!; return <path key={edge.id} d={edgePath(source, target)} fill="none" stroke="currentColor" className="text-primary/55" strokeWidth="0.48" markerEnd="url(#nawa-flow-arrow)" />; })}</svg>
          {nawaFlowNodes.map(node => { const status = getFlowNodeStatus(node, modules, restrictedNodeIds); const Icon = node.icon; const isSelected = selected?.id === node.id; const statusLabel = status === "available" ? t("available") : status === "restricted" ? t("restricted") : t("locked"); return <button key={node.id} style={nodeStyle(node)} onClick={() => node.id === "commerce" && status === "available" ? setInternalOpen(true) : setSelectedId(node.id)} className={`absolute w-44 rounded-2xl border p-4 text-start shadow-lg outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary ${status === "available" ? "border-primary/35 bg-card/95 text-white hover:-translate-y-1 hover:border-primary/70" : "border-white/10 bg-card/75 text-slate-400 hover:border-primary/25"} ${isSelected ? "ring-2 ring-primary/70" : ""}`} aria-label={`${t(node.labelKey)} — ${statusLabel}`}><div className="flex items-start justify-between gap-2"><div className={`grid h-9 w-9 place-items-center rounded-xl ${status === "available" ? "bg-primary/12 text-primary" : "bg-white/[.06] text-slate-500"}`}><Icon className="h-4 w-4" /></div>{status === "available" ? <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-3 w-3" /></span> : <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[.08] text-slate-400"><LockKeyhole className="h-3 w-3" /></span>}</div><p className="mt-3 text-sm font-bold leading-5">{t(node.labelKey)}</p><p className="mt-1 text-[11px] text-muted-foreground">{statusLabel}</p></button>; })}
        </div>
        <div className="space-y-3 md:hidden" aria-label={t("businessFlowMap")}>{nawaFlowNodes.map((node, index) => { const status = getFlowNodeStatus(node, modules, restrictedNodeIds); const Icon = node.icon; const statusLabel = status === "available" ? t("available") : status === "restricted" ? t("restricted") : t("locked"); return <div key={node.id}><button onClick={() => node.id === "commerce" && status === "available" ? setInternalOpen(true) : setSelectedId(node.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-start ${status === "available" ? "border-primary/30 bg-primary/[.06]" : "border-white/10 bg-white/[.025]"}`}><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[.06] text-primary"><Icon className="h-5 w-5" /></div><div className="flex-1"><p className="text-sm font-bold text-white">{t(node.labelKey)}</p><p className="mt-1 text-[11px] text-muted-foreground">{statusLabel}</p></div>{status === "available" ? <Check className="h-4 w-4 text-emerald-300" /> : <LockKeyhole className="h-4 w-4 text-slate-500" />}</button>{index < nawaFlowNodes.length - 1 && <div className="mx-auto h-5 w-px bg-primary/35" />}</div>; })}</div>
      </div>

      {selected && <aside className="surface rounded-3xl border p-5" aria-live="polite">{(() => { const selectedStatus = getFlowNodeStatus(selected, modules, restrictedNodeIds); return <><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-primary">{t("flowOverview")}</p><h2 className="mt-1 text-xl font-bold text-white">{t(selected.labelKey)}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{selectedStatus === "available" ? t("flowOverview") : selectedStatus === "restricted" ? t("flowRestrictedDescription") : t(selected.descriptionKey)}</p></div><button onClick={() => setSelectedId(null)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-white/[.05]" aria-label={t("cancel")}><X className="h-4 w-4" /></button></div>{selectedStatus === "available" ? <div className="mt-5"><div className="flex flex-wrap items-center gap-2">{selected.internalNodes?.map((node, index) => { const Icon = node.icon; const Chevron = isRtl ? ChevronLeft : ChevronRight; return <div key={node.key} className="flex items-center gap-2 rounded-xl bg-white/[.035] px-3 py-2"><Icon className="h-4 w-4 text-primary" /><span className="text-xs text-slate-200">{t(node.key)}</span>{index < (selected.internalNodes?.length ?? 0) - 1 && <Chevron className="h-3.5 w-3.5 text-primary" />}</div>; })}</div><Button onClick={onOpenClassic} className="mt-5 gap-2 rounded-xl bg-primary text-primary-foreground"><Arrow className="h-4 w-4" />{t("openModule")}</Button></div> : selectedStatus === "locked" ? <div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl border-primary/25 bg-primary/[.06] text-primary">{t("explore")}</Button><Button variant="outline" className="rounded-xl border-white/10 bg-white/[.03] text-slate-300">{t("upgrade")}</Button></div> : null}</>; })()}</aside>}
    </section>
  );
}
