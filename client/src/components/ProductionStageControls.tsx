import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Play, UserRound } from "lucide-react";

type Draft = { responsibleUserId?: string; notes?: string };

const labels = {
  ar: { title: "تشغيل المراحل والمسؤوليات", description: "تُسند المسؤولية إلى مستخدمي النظام المصرح لهم فقط.", owner: "مسؤول المرحلة", unassigned: "من دون تعيين", notes: "ملاحظات المرحلة", start: "بدء المرحلة", complete: "إكمال المرحلة", consumption: "الاستهلاك الفعلي", noStages: "لا توجد مراحل إنتاج لهذا الأمر." },
  fr: { title: "Étapes et responsabilités", description: "La responsabilité est limitée aux utilisateurs autorisés.", owner: "Responsable de l’étape", unassigned: "Non attribué", notes: "Notes de l’étape", start: "Démarrer l’étape", complete: "Terminer l’étape", consumption: "Consommation réelle", noStages: "Aucune étape de production pour cet ordre." },
  en: { title: "Stages & responsibilities", description: "Assignment is limited to authorized system users.", owner: "Stage owner", unassigned: "Unassigned", notes: "Stage notes", start: "Start stage", complete: "Complete stage", consumption: "Actual consumption", noStages: "There are no production stages for this order." },
} as const;

export function ProductionStageControls({ productionOrderId, onChanged }: { productionOrderId: number; onChanged: () => void }) {
  const { language, direction } = useLanguage();
  const copy = labels[language];
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const capabilities = trpc.erp.manufacturing.capabilities.useQuery();
  const options = trpc.erp.manufacturing.operationalOptions.useQuery();
  const details = trpc.erp.manufacturing.orderDetails.useQuery({ productionOrderId });
  const canStart = Boolean(capabilities.data?.capabilities["manufacturing.order.start"]);
  const canComplete = Boolean(capabilities.data?.capabilities["manufacturing.order.complete"]);
  const updateStage = trpc.erp.manufacturing.updateStage.useMutation({ onSuccess: () => { void details.refetch(); onChanged(); } });
  const draftFor = (stage: { id: number; responsibleUserId?: number | null; notes?: string | null }) => drafts[stage.id] ?? { responsibleUserId: stage.responsibleUserId ? String(stage.responsibleUserId) : "unassigned", notes: stage.notes ?? "" };
  const updateDraft = (stageId: number, patch: Partial<Draft>) => setDrafts(current => ({ ...current, [stageId]: { ...current[stageId], ...patch } }));
  const submit = (stage: { id: number; responsibleUserId?: number | null; notes?: string | null }, status: "in_progress" | "completed") => {
    const draft = draftFor(stage);
    updateStage.mutate({ productionOrderId, stageId: stage.id, status, responsibleUserId: draft.responsibleUserId && draft.responsibleUserId !== "unassigned" ? Number(draft.responsibleUserId) : undefined, notes: draft.notes?.trim() || undefined });
  };
  const actualConsumption = details.data?.reservations.reduce((sum, item) => sum + Number(item.consumedQuantity ?? 0), 0) ?? 0;

  return <Card dir={direction} className="border-primary/20"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-primary" />{copy.title}</CardTitle><CardDescription>{copy.description} · {copy.consumption}: {actualConsumption.toFixed(3)}</CardDescription></CardHeader><CardContent className="space-y-3">{details.isLoading ? <p className="text-sm text-muted-foreground">…</p> : !details.data?.stages.length ? <p className="text-sm text-muted-foreground">{copy.noStages}</p> : details.data.stages.map(stage => { const draft = draftFor(stage); return <div key={stage.id} className="grid gap-3 rounded-xl border bg-muted/15 p-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.65fr)_minmax(220px,1fr)_auto]"><div><p className="font-medium">{stage.sequence}. {stage.name}</p><p className="text-xs text-muted-foreground">{stage.code} · {stage.status}</p></div><div className="space-y-1"><Label>{copy.owner}</Label><Select value={draft.responsibleUserId ?? "unassigned"} onValueChange={responsibleUserId => updateDraft(stage.id, { responsibleUserId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">{copy.unassigned}</SelectItem>{options.data?.responsibleUsers.map(user => <SelectItem key={user.userId} value={String(user.userId)}>{user.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>{copy.notes}</Label><Input value={draft.notes ?? ""} onChange={event => updateDraft(stage.id, { notes: event.target.value })} /></div><div className="flex flex-wrap items-end gap-2">{canStart ? <Button size="sm" variant="outline" disabled={updateStage.isPending} onClick={() => submit(stage, "in_progress")}><Play className="me-1.5 h-4 w-4" />{copy.start}</Button> : null}{canComplete ? <Button size="sm" disabled={updateStage.isPending} onClick={() => submit(stage, "completed")}><CheckCircle2 className="me-1.5 h-4 w-4" />{copy.complete}</Button> : null}</div></div>; })}</CardContent></Card>;
}
