import { Button } from "@/components/ui/button";
import { buildDocumentPreviewHtml, type DocumentPreviewExportData } from "@/lib/documentPreviewExport";
import { FileDown } from "lucide-react";

export function DocumentPreviewDownloadButton({ label, filename, data }: { label: string; filename: string; data: DocumentPreviewExportData }) {
  const download = () => {
    const preview = window.open("", "_blank", "noopener,noreferrer");
    if (!preview) return;
    preview.document.open();
    preview.document.write(buildDocumentPreviewHtml(data));
    preview.document.title = filename;
    preview.document.close();
    preview.focus();
    preview.print();
  };

  return <Button type="button" variant="outline" onClick={download} className="border-white/10 bg-white/[.03] text-slate-200"><FileDown className="me-2 h-4 w-4" />{label}</Button>;
}
