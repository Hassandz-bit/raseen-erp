import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, Columns3, Loader2, RotateCcw } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type TableDensity = "compact" | "normal" | "comfortable";
export type TableColumn = { id: string; label: string; locked?: boolean };
type StoredView = { density?: TableDensity; hiddenColumnIds?: string[]; columnOrder?: string[] };

export function normalizeTableView(columns: TableColumn[], view: StoredView = {}) {
  const ids = columns.map(column => column.id);
  const columnOrder = [...(view.columnOrder ?? []).filter(id => ids.includes(id)), ...ids.filter(id => !(view.columnOrder ?? []).includes(id))];
  const hiddenColumnIds = (view.hiddenColumnIds ?? []).filter(id => ids.includes(id) && !columns.find(column => column.id === id)?.locked);
  return { columnOrder, hiddenColumnIds, density: view.density ?? "normal" as TableDensity };
}

export function useTableViewPreferences(tableId: string, columns: TableColumn[]) {
  const preferences = trpc.erp.preferences.user.useQuery();
  const save = trpc.erp.preferences.saveUser.useMutation({ onSuccess: () => void preferences.refetch(), onError: () => toast.error("تعذر حفظ تفضيل الجدول") });
  const stored = preferences.data?.tablePreferences?.[tableId] as StoredView | undefined;
  const [view, setView] = useState<StoredView>({});
  const signature = JSON.stringify(stored ?? {});
  useEffect(() => { setView(stored ?? {}); }, [signature]);
  const normalized = useMemo(() => normalizeTableView(columns, view), [columns, view]);
  const persist = (next: StoredView) => {
    setView(next);
    save.mutate({ tablePreferences: { ...(preferences.data?.tablePreferences ?? {}), [tableId]: next } });
  };
  return { ...normalized, isSaving: save.isPending, setDensity: (density: TableDensity) => persist({ ...view, density }), setHiddenColumnIds: (ids: string[]) => persist({ ...view, hiddenColumnIds: ids }), setColumnOrder: (order: string[]) => persist({ ...view, columnOrder: order }), reset: () => persist({}), columns };
}

export function TableViewControls({ view }: { view: ReturnType<typeof useTableViewPreferences> }) {
  const { language } = useLanguage();
  const copy = language === "ar" ? { title: "عرض الجدول", density: "كثافة العرض", compact: "مضغوط", normal: "عادي", comfortable: "مريح", columns: "الأعمدة", reset: "استعادة الافتراضي", hide: "إخفاء أو إظهار", move: "ترتيب" } : language === "fr" ? { title: "Affichage", density: "Densité", compact: "Compact", normal: "Normal", comfortable: "Confortable", columns: "Colonnes", reset: "Réinitialiser", hide: "Afficher ou masquer", move: "Ordre" } : { title: "Table view", density: "Density", compact: "Compact", normal: "Normal", comfortable: "Comfortable", columns: "Columns", reset: "Reset", hide: "Show or hide", move: "Order" };
  const labels: Record<TableDensity, string> = { compact: copy.compact, normal: copy.normal, comfortable: copy.comfortable };
  const orderedColumns = view.columnOrder.map(id => view.columns.find(column => column.id === id)!).filter(Boolean);
  const move = (id: string, delta: -1 | 1) => { const index = view.columnOrder.indexOf(id); const target = index + delta; if (target < 0 || target >= view.columnOrder.length) return; const next = [...view.columnOrder]; [next[index], next[target]] = [next[target], next[index]]; view.setColumnOrder(next); };
  return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2" aria-label={copy.title}><Columns3 className="h-4 w-4" />{copy.title}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 p-3" dir={language === "ar" ? "rtl" : "ltr"}><div className="flex items-center justify-between gap-2"><p className="font-semibold">{copy.title}</p><Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" disabled={view.isSaving} onClick={view.reset}><RotateCcw className="h-3.5 w-3.5" />{copy.reset}</Button></div><div className="mt-3"><p className="text-xs font-medium text-muted-foreground">{copy.density}</p><div className="mt-2 grid grid-cols-3 gap-1">{(["compact", "normal", "comfortable"] as TableDensity[]).map(density => <Button key={density} size="sm" variant={view.density === density ? "default" : "outline"} disabled={view.isSaving} onClick={() => view.setDensity(density)} className="px-2 text-xs">{labels[density]}</Button>)}</div></div><div className="mt-4 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">{copy.columns}</p><div className="mt-2 space-y-1">{orderedColumns.map((column, index) => { const hidden = view.hiddenColumnIds.includes(column.id); return <div key={column.id} className="flex items-center gap-2 rounded-lg px-1 py-1"><Checkbox id={`${column.id}-visibility`} checked={!hidden} disabled={column.locked || view.isSaving} onCheckedChange={checked => view.setHiddenColumnIds(checked ? view.hiddenColumnIds.filter(id => id !== column.id) : [...view.hiddenColumnIds, column.id])} /><label htmlFor={`${column.id}-visibility`} className="min-w-0 flex-1 truncate text-sm">{column.label}</label><Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0 || view.isSaving} onClick={() => move(column.id, -1)} aria-label={`${copy.move} ${column.label} للأعلى`}><ChevronUp className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === orderedColumns.length - 1 || view.isSaving} onClick={() => move(column.id, 1)} aria-label={`${copy.move} ${column.label} للأسفل`}><ChevronDown className="h-3.5 w-3.5" /></Button></div>; })}</div></div>{view.isSaving ? <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />…</div> : null}</PopoverContent></Popover>;
}
