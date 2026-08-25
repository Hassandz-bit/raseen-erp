import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Download, FileCheck2, FileUp, History, Loader2, RefreshCw, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const MAX_BACKUP_BYTES = 48 * 1024 * 1024;

type BackupPreview = {
  compatible: boolean;
  createdAt: string;
  source: { organizationName: string };
  checksum: string;
  rowCounts: Record<string, number>;
  moduleCounts: Record<string, number>;
  excludedScopes: readonly string[];
};

const copy = {
  ar: {
    eyebrow: "إعدادات المؤسسة · استمرارية العمل", title: "النسخ الاحتياطي والتعافي", description: "نزّل لقطة محلية مشفّرة التحقق من بيانات مؤسستك. عند وقوع مشكلة، ارفع الملف لفحصه قبل أن تختار بوضوح بين الاستئناف من النسخة أو متابعة البيانات الحالية.", export: "تنزيل نسخة المؤسسة", exporting: "يجري تجهيز النسخة…", exportHint: "تشمل السجلات التشغيلية للتجارة والمخزون والتوزيع والتصنيع والمالية والموارد البشرية. لا تشمل حسابات المستخدمين أو الجلسات أو الأسرار.", uploadTitle: "رفع نسخة للتحقق", uploadHint: "لا يكتب رفع الملف أي بيانات. يُفحص الإصدار والبصمة وSHA‑256 وعدد السجلات أولاً.", chooseFile: "اختيار ملف النسخة", checking: "يجري الفحص…", chooseAnother: "اختيار ملف آخر", compatible: "النسخة متوافقة مع المؤسسة الحالية", notCompatible: "هذه النسخة تخص مؤسسة أخرى أو لا تطابق بصمتها المؤسسة الحالية.", created: "تاريخ الإنشاء", checksum: "بصمة السلامة", records: "إجمالي السجلات", resume: "الاستئناف من النسخة", continue: "متابعة البيانات الحالية", continueHint: "لن تُكتب أو تُحذف أي بيانات. يمكنك المتابعة الآن والعودة إلى الملف لاحقاً.", restored: "اكتملت الاستعادة. أعد تحميل الصفحة لرؤية البيانات المستعادة.", previewError: "تعذر فحص ملف النسخة", exportError: "تعذر إنشاء النسخة المحلية", restoreError: "تعذرت الاستعادة؛ لم يُستبدل شيء إذا فشلت العملية داخل المعاملة.", sizeError: "حجم الملف يتجاوز الحد الآمن المدعوم (48 ميغابايت).", formatError: "اختر ملف JSON للنسخة الاحتياطية.", ownership: "النسخ والاستعادة متاحان لمالك المؤسسة فقط.", excluded: "مستثنى عمداً", modules: "ملخص الوحدات", eventHistory: "آخر عمليات التعافي", noEvents: "لا توجد عملية تعافٍ مسجلة بعد.", confirmTitle: "تأكيد الاستئناف من النسخة", confirmDescription: "سيُحفظ أولاً Snapshot خادمي واقٍ للحالة الحالية، ثم تُستبدل بيانات المؤسسة التشغيلية فقط داخل معاملة واحدة. لن تتأثر العضويات أو الحسابات أو الأسرار.", typeConfirmation: "اكتب العبارة التالية للمتابعة", confirmation: "استئناف من النسخة", cancel: "إلغاء", restoring: "يجري الاستئناف…", actualRestore: "تأكيد الاستئناف", fileSelected: "ملف النسخة المختار", noFile: "لم يُختر ملف بعد", safety: "لا استعادة تلقائية", safetyHint: "لن يبدأ أي استبدال إلا بعد فحص حزمة متوافقة وكتابة عبارة التأكيد الصريحة.", rows: "سجل", source: "المؤسسة المصدر", successContinue: "استمر العمل بالبيانات الحالية؛ لم يجرِ أي تغيير.", unknown: "غير معروف",
  },
  fr: {
    eyebrow: "Paramètres de l’organisation · Continuité", title: "Sauvegarde et reprise", description: "Téléchargez un instantané local vérifié de votre organisation. En cas d’incident, importez-le d’abord pour validation, puis choisissez explicitement la reprise ou la continuité avec les données actuelles.", export: "Télécharger la sauvegarde", exporting: "Préparation…", exportHint: "Inclut les données opérationnelles de commerce, stock, distribution, production, finance et RH. Exclut les comptes, sessions et secrets.", uploadTitle: "Importer une sauvegarde pour vérification", uploadHint: "L’import ne modifie aucune donnée. La version, l’empreinte, SHA‑256 et les comptes sont contrôlés d’abord.", chooseFile: "Choisir le fichier", checking: "Vérification…", chooseAnother: "Choisir un autre fichier", compatible: "Sauvegarde compatible avec l’organisation actuelle", notCompatible: "Cette sauvegarde appartient à une autre organisation ou son empreinte ne correspond pas.", created: "Créée le", checksum: "Empreinte d’intégrité", records: "Total des enregistrements", resume: "Reprendre depuis la sauvegarde", continue: "Continuer avec les données actuelles", continueHint: "Aucune donnée ne sera écrite ni supprimée. Vous pouvez revenir au fichier plus tard.", restored: "Reprise terminée. Rechargez la page pour voir les données restaurées.", previewError: "Impossible de vérifier la sauvegarde", exportError: "Impossible de créer la sauvegarde locale", restoreError: "Reprise impossible ; aucune donnée n’est remplacée si la transaction échoue.", sizeError: "Le fichier dépasse la limite sûre prise en charge (48 Mo).", formatError: "Choisissez un fichier JSON de sauvegarde.", ownership: "La sauvegarde et la reprise sont réservées au propriétaire de l’organisation.", excluded: "Exclu intentionnellement", modules: "Résumé des modules", eventHistory: "Dernières reprises", noEvents: "Aucune reprise enregistrée.", confirmTitle: "Confirmer la reprise", confirmDescription: "Un instantané serveur protecteur de l’état actuel sera créé, puis seules les données opérationnelles seront remplacées dans une transaction. Les comptes, adhésions et secrets restent intacts.", typeConfirmation: "Saisissez la phrase suivante", confirmation: "Reprendre depuis la sauvegarde", cancel: "Annuler", restoring: "Reprise…", actualRestore: "Confirmer la reprise", fileSelected: "Fichier sélectionné", noFile: "Aucun fichier sélectionné", safety: "Pas de reprise automatique", safetyHint: "Aucun remplacement ne commence sans un package validé et la phrase de confirmation explicite.", rows: "lignes", source: "Organisation source", successContinue: "Les données actuelles sont conservées ; aucune modification n’a été effectuée.", unknown: "Inconnu",
  },
  en: {
    eyebrow: "Organization settings · Business continuity", title: "Backup & recovery", description: "Download a verified local snapshot of your organization. If something goes wrong, upload it for validation first, then explicitly choose to resume from it or continue with current data.", export: "Download organization backup", exporting: "Preparing backup…", exportHint: "Includes operational commerce, inventory, distribution, manufacturing, finance, and HR records. User accounts, sessions, and secrets are excluded.", uploadTitle: "Upload a backup for validation", uploadHint: "Uploading writes no data. Version, fingerprint, SHA‑256, and row counts are checked first.", chooseFile: "Choose backup file", checking: "Validating…", chooseAnother: "Choose another file", compatible: "Backup is compatible with this organization", notCompatible: "This backup belongs to another organization or its fingerprint does not match.", created: "Created", checksum: "Integrity checksum", records: "Total records", resume: "Resume from backup", continue: "Continue with current data", continueHint: "No data will be written or deleted. You can return to this file later.", restored: "Recovery completed. Reload this page to see restored data.", previewError: "The backup file could not be validated", exportError: "The local backup could not be created", restoreError: "Recovery failed; no data is replaced if the transaction fails.", sizeError: "The file exceeds the supported safe limit (48 MB).", formatError: "Choose a JSON backup file.", ownership: "Backup and recovery are available only to the organization owner.", excluded: "Intentionally excluded", modules: "Module summary", eventHistory: "Recent recovery actions", noEvents: "No recovery action recorded yet.", confirmTitle: "Confirm resume from backup", confirmDescription: "A protective server snapshot of the current state is created first; then only operational organization data is replaced in one transaction. Memberships, accounts, and secrets are untouched.", typeConfirmation: "Type the following phrase to continue", confirmation: "Resume from backup", cancel: "Cancel", restoring: "Resuming…", actualRestore: "Confirm resume", fileSelected: "Selected backup file", noFile: "No file selected", safety: "No automatic recovery", safetyHint: "No replacement begins without a validated package and the explicit confirmation phrase.", rows: "records", source: "Source organization", successContinue: "Current data is kept; no changes were made.", unknown: "Unknown",
  },
} as const;

function totalRows(rowCounts: Record<string, number>) { return Object.values(rowCounts).reduce((sum, count) => sum + count, 0); }

export function OrganizationBackupRecoveryPanel() {
  const { language } = useLanguage();
  const text = copy[language];
  const utils = trpc.useUtils();
  const [serialized, setSerialized] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const exportBackup = trpc.erp.backup.export.useMutation({ onError: error => toast.error(error.message || text.exportError) });
  const validateBackup = trpc.erp.backup.preview.useMutation({ onError: error => { setPreview(null); toast.error(error.message || text.previewError); } });
  const restoreBackup = trpc.erp.backup.restore.useMutation({ onSuccess: () => { toast.success(text.restored); setConfirmOpen(false); setConfirmation(""); setSerialized(undefined); setPreview(null); setFileName(undefined); void utils.erp.backup.events.invalidate(); }, onError: error => toast.error(error.message || text.restoreError) });
  const events = trpc.erp.backup.events.useQuery(undefined, { retry: false });
  const summary = useMemo(() => preview ? Object.entries(preview.moduleCounts).filter(([, count]) => count > 0) : [], [preview]);

  const downloadBackup = async () => {
    try {
      const result = await exportBackup.mutateAsync();
      const content = JSON.stringify(result.bundle, null, 2);
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success(text.export);
    } catch { /* mutation handler reports the error */ }
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") return toast.error(text.formatError);
    if (file.size > MAX_BACKUP_BYTES) return toast.error(text.sizeError);
    try {
      const raw = await file.text();
      setSerialized(raw); setFileName(file.name); setPreview(null);
      const result = await validateBackup.mutateAsync({ serialized: raw });
      setPreview(result);
    } catch { /* mutation handler reports the error */ }
  };

  const continueCurrent = () => { setSerialized(undefined); setPreview(null); setFileName(undefined); setConfirmation(""); toast.success(text.successContinue); };
  const submitRestore = async () => {
    if (!serialized || !preview?.compatible || confirmation !== text.confirmation) return;
    try { await restoreBackup.mutateAsync({ serialized, confirmation }); } catch { /* mutation handler reports the error */ }
  };
  const formattedDate = (value: unknown) => value ? new Date(String(value)).toLocaleString(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US") : text.unknown;

  return <div className="space-y-5">
    <section className="surface overflow-hidden rounded-3xl border border-primary/25 p-0">
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(215,181,109,.18),transparent_38%)] p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl"><p className="text-xs font-semibold tracking-wide text-primary">{text.eyebrow}</p><h2 className="mt-2 flex items-center gap-3 text-2xl font-bold text-white"><ShieldCheck className="h-7 w-7 text-primary" />{text.title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{text.description}</p></div>
          <Button onClick={() => void downloadBackup()} disabled={exportBackup.isPending} className="min-h-11 shrink-0 shadow-lg shadow-primary/10"><Download className="me-2 h-4 w-4" />{exportBackup.isPending ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{text.exporting}</> : text.export}</Button>
        </div>
        <div className="mt-5 flex gap-3 rounded-2xl border border-primary/20 bg-primary/[.045] p-4 text-sm text-slate-200"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="leading-6">{text.exportHint}</p></div>
      </div>
    </section>

    <section className="surface rounded-3xl border p-6 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="flex items-center gap-2 text-lg font-bold text-white"><FileCheck2 className="h-5 w-5 text-primary" />{text.uploadTitle}</h3><p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{text.uploadHint}</p></div><label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-primary/35 bg-primary/[.08] px-4 text-sm font-semibold text-primary transition hover:bg-primary/[.14]"><FileUp className="me-2 h-4 w-4" />{validateBackup.isPending ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{text.checking}</> : serialized ? text.chooseAnother : text.chooseFile}<input className="sr-only" type="file" accept="application/json,.json" onChange={event => void chooseFile(event)} disabled={validateBackup.isPending || restoreBackup.isPending} /></label></div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] px-4 py-3 text-sm"><span className="text-muted-foreground">{text.fileSelected}: </span><span className="font-medium text-white">{fileName ?? text.noFile}</span></div>
    </section>

    {preview ? <section className={`rounded-3xl border p-6 sm:p-7 ${preview.compatible ? "border-emerald-400/30 bg-emerald-400/[.045]" : "border-destructive/35 bg-destructive/[.045]"}`}>
      <div className="flex gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${preview.compatible ? "bg-emerald-400/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>{preview.compatible ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}</div><div><h3 className="font-bold text-white">{preview.compatible ? text.compatible : text.notCompatible}</h3><p className="mt-1 text-sm text-muted-foreground">{text.source}: {preview.source.organizationName} · {text.created}: {formattedDate(preview.createdAt)}</p></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-muted-foreground">{text.records}</p><p className="mt-2 text-2xl font-bold text-white">{totalRows(preview.rowCounts).toLocaleString()}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">{text.checksum}</p><p className="mt-2 truncate font-mono text-xs text-slate-200" title={preview.checksum}>{preview.checksum}</p></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:col-span-2 xl:col-span-2"><p className="text-sm font-semibold text-white">{text.modules}</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{summary.map(([module, count]) => <div key={module} className="flex justify-between gap-2 rounded-lg bg-white/[.04] px-3 py-2"><span className="capitalize text-muted-foreground">{module}</span><b className="text-white">{count.toLocaleString()}</b></div>)}</div></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:col-span-2"><p className="text-sm font-semibold text-white">{text.excluded}</p><ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">{preview.excludedScopes.map(item => <li key={item}>• {item}</li>)}</ul></div></div>
      <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-sm leading-6 text-muted-foreground">{text.safetyHint}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={continueCurrent} disabled={restoreBackup.isPending}><RefreshCw className="me-2 h-4 w-4" />{text.continue}</Button><Button onClick={() => setConfirmOpen(true)} disabled={!preview.compatible || restoreBackup.isPending}><ShieldCheck className="me-2 h-4 w-4" />{text.resume}</Button></div></div>
    </section> : null}

    <section className="surface rounded-3xl border p-6 sm:p-7"><h3 className="flex items-center gap-2 text-lg font-bold text-white"><History className="h-5 w-5 text-primary" />{text.eventHistory}</h3>{events.isLoading ? <Loader2 className="mt-5 h-5 w-5 animate-spin text-primary" /> : events.isError ? <p className="mt-4 text-sm text-destructive">{text.ownership}</p> : events.data?.length ? <div className="mt-5 space-y-2">{events.data.map(event => <div key={String(event.id)} className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[.025] p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-medium text-white">{event.action === "restore_completed" ? text.resume : event.action === "restore_failed" ? text.restoreError : text.safety}</p><p className="text-xs text-muted-foreground">{formattedDate(event.createdAt)}</p></div>)}</div> : <p className="mt-5 text-sm text-muted-foreground">{text.noEvents}</p>}</section>

    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent dir={language === "ar" ? "rtl" : "ltr"} className="max-w-xl border-primary/30"><DialogHeader><DialogTitle className="flex items-center gap-2 text-white"><ShieldAlert className="h-5 w-5 text-primary" />{text.confirmTitle}</DialogTitle><DialogDescription className="leading-6">{text.confirmDescription}</DialogDescription></DialogHeader><label className="block text-sm font-medium text-slate-200">{text.typeConfirmation}<code className="mt-2 block rounded-lg border border-primary/25 bg-primary/[.06] px-3 py-2 text-primary">{text.confirmation}</code><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-3" autoComplete="off" /></label><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={restoreBackup.isPending}>{text.cancel}</Button><Button onClick={() => void submitRestore()} disabled={!preview?.compatible || confirmation !== text.confirmation || restoreBackup.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{restoreBackup.isPending ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{text.restoring}</> : text.actualRestore}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
