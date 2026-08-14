import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocumentPreviewActions({ onDownload, onPrint, downloadLabel, printLabel }: { onDownload: () => void; onPrint: () => void; downloadLabel: string; printLabel: string }) {
  return <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={onDownload}><FileDown className="me-2 h-4 w-4" />{downloadLabel}</Button><Button type="button" variant="outline" onClick={onPrint} className="border-white/10 bg-white/[.03] text-slate-200"><Printer className="me-2 h-4 w-4" />{printLabel}</Button></div>;
}
