import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RASEEN_PRINT_LOGO_URL } from "@/config/raseenBrandAssets";
import { Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export const PRINT_PAPER_OPTIONS = ["A4", "A5", "letter"] as const;
export type PrintPaperSize = (typeof PRINT_PAPER_OPTIONS)[number];
export type PrintOrientation = "portrait" | "landscape";

export function buildPrintPageRule(paperSize: PrintPaperSize, orientation: PrintOrientation) {
  return `@page { size: ${paperSize === "letter" ? "letter" : paperSize} ${orientation}; margin: 12mm; }`;
}

type DocumentSettings = {
  paperSize?: "A4" | "A5" | "thermal";
  logoUrl?: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  legalInfo?: string;
};

const copy = {
  ar: { open: "معاينة الطباعة", title: "معاينة وتجهيز الطباعة", description: "راجع ترويسة المؤسسة واختر حجم واتجاه الورق قبل فتح نافذة الطابعة.", paper: "حجم الورق", orientation: "اتجاه الورق", portrait: "عمودي", landscape: "أفقي", cancel: "إلغاء", print: "فتح نافذة الطباعة", preview: "معاينة الصفحة", legal: "البيانات القانونية", tax: "الرقم الضريبي" },
  fr: { open: "Aperçu d’impression", title: "Aperçu et préparation", description: "Vérifiez l’en-tête de l’entreprise et choisissez le format et l’orientation avant d’ouvrir l’impression.", paper: "Format du papier", orientation: "Orientation", portrait: "Portrait", landscape: "Paysage", cancel: "Annuler", print: "Ouvrir l’impression", preview: "Aperçu de page", legal: "Informations légales", tax: "N° fiscal" },
  en: { open: "Print preview", title: "Preview & print setup", description: "Review the organization header and choose paper size and orientation before opening the print dialog.", paper: "Paper size", orientation: "Orientation", portrait: "Portrait", landscape: "Landscape", cancel: "Cancel", print: "Open print dialog", preview: "Page preview", legal: "Legal information", tax: "Tax number" },
} as const;

export function PagePrintPreview({ language, direction, organizationName, pageLabel, documentSettings }: { language: "ar" | "fr" | "en"; direction: "rtl" | "ltr"; organizationName: string; pageLabel: string; documentSettings?: DocumentSettings }) {
  const text = copy[language];
  const [open, setOpen] = useState(false);
  const initialPaperSize = documentSettings?.paperSize === "A5" ? "A5" : "A4";
  const [paperSize, setPaperSize] = useState<PrintPaperSize>(initialPaperSize);
  const [orientation, setOrientation] = useState<PrintOrientation>("portrait");
  const previewContentRef = useRef<HTMLDivElement>(null);
  const legalLines = useMemo(() => [documentSettings?.address, documentSettings?.phone, documentSettings?.taxNumber ? `${text.tax}: ${documentSettings.taxNumber}` : undefined, documentSettings?.legalInfo].filter(Boolean) as string[], [documentSettings?.address, documentSettings?.legalInfo, documentSettings?.phone, documentSettings?.taxNumber, text.tax]);

  useEffect(() => {
    if (!open || !previewContentRef.current) return;
    const source = document.querySelector(".nawa-workspace-inner");
    const copy = source?.cloneNode(true) as HTMLElement | null;
    if (!copy) return;
    copy.querySelectorAll(".nawa-print-only, button, input, select, textarea, [role='combobox'], .no-print").forEach(element => element.remove());
    previewContentRef.current.replaceChildren(copy);
  }, [open]);

  const openPrintDialog = () => {
    const existing = document.getElementById("nawa-page-print-settings");
    const style = existing ?? document.createElement("style");
    style.id = "nawa-page-print-settings";
    style.textContent = buildPrintPageRule(paperSize, orientation);
    if (!existing) document.head.appendChild(style);
    setOpen(false);
    requestAnimationFrame(() => window.print());
  };

  return <><Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={text.open} className="nawa-header-icon nawa-header-print gap-1.5 px-2"><Printer className="h-5 w-5" /><span className="hidden xl:inline text-xs font-bold">{text.open}</span></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir={direction} className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{text.title}</DialogTitle><DialogDescription>{text.description}</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold text-foreground"><span>{text.paper}</span><select value={paperSize} onChange={event => setPaperSize(event.target.value as PrintPaperSize)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium"><option value="A4">A4</option><option value="A5">A5</option><option value="letter">Letter</option></select></label><fieldset className="space-y-2"><legend className="text-sm font-bold text-foreground">{text.orientation}</legend><div className="grid grid-cols-2 gap-2"><Button type="button" variant={orientation === "portrait" ? "default" : "outline"} onClick={() => setOrientation("portrait")} className="gap-1.5"><span className="h-4 w-3 rounded-sm border border-current" />{text.portrait}</Button><Button type="button" variant={orientation === "landscape" ? "default" : "outline"} onClick={() => setOrientation("landscape")} className="gap-1.5"><span className="h-3 w-4 rounded-sm border border-current" />{text.landscape}</Button></div></fieldset></div><section className={`nawa-print-preview-sheet ${orientation === "landscape" ? "nawa-print-preview-landscape" : ""}`} aria-label={text.preview}><header className="nawa-print-preview-header"><img src={RASEEN_PRINT_LOGO_URL} alt="RASEEN ERP" className="h-12 w-16 rounded-lg object-contain" />{documentSettings?.logoUrl ? <img src={documentSettings.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" /> : null}<div className="min-w-0 flex-1"><p className="text-base font-black text-foreground">{organizationName}</p><p className="mt-0.5 text-xs font-semibold text-primary">{pageLabel}</p></div><div className="max-w-56 text-end text-[10px] leading-4 text-muted-foreground">{legalLines.length ? legalLines.map(line => <p key={line}>{line}</p>) : <p>{text.legal}</p>}</div></header><div ref={previewContentRef} className="nawa-print-preview-content" /></section><DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{text.cancel}</Button><Button type="button" onClick={openPrintDialog} className="gap-2"><Printer className="h-4 w-4" />{text.print}</Button></DialogFooter></DialogContent></Dialog></>;
}
