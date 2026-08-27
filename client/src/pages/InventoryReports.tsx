import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { downloadDistributionPdf } from "@/lib/distributionReportExport";
import { buildDocumentPreviewHtml, type DocumentPreviewExportData } from "@/lib/documentPreviewExport";
import { trpc } from "@/lib/trpc";
import { Boxes, Download, Loader2, Printer, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

const copy = {
  ar: { eyebrow: "التجارة والمخزون", title: "تقارير المخزون", description: "ملخص قابل للطباعة للكميات والدفعات وحالة مخزون المؤسسة.", ready: "البيانات جاهزة للطباعة", loading: "يجري تحميل بيانات التقرير…", empty: "لا توجد بيانات مخزون قابلة للتصدير حالياً.", pdf: "حفظ PDF", print: "طباعة التقرير", refresh: "تحديث", generated: "تاريخ إنشاء التقرير", amount: "إجمالي الكمية المتاحة", products: "إجمالي المنتجات", activeProducts: "منتجات نشطة", warehouses: "المخازن", batches: "الدفعات", availableQuantity: "إجمالي كمية الدفعات", heldBatches: "دفعات محجوبة أو منتهية", nearExpiry: "دفعات تنتهي خلال 30 يوماً", printError: "تعذر فتح نافذة الطباعة. تحقق من السماح بالنوافذ المنبثقة.", pdfError: "تعذر إنشاء ملف PDF لتقرير المخزون." },
  fr: { eyebrow: "Commerce et stock", title: "Rapports de stock", description: "Synthèse imprimable des quantités, lots et états de stock de l’organisation.", ready: "Données prêtes à imprimer", loading: "Chargement des données du rapport…", empty: "Aucune donnée de stock exportable pour le moment.", pdf: "Enregistrer en PDF", print: "Imprimer le rapport", refresh: "Actualiser", generated: "Date de génération", amount: "Quantité disponible totale", products: "Produits totaux", activeProducts: "Produits actifs", warehouses: "Entrepôts", batches: "Lots", availableQuantity: "Quantité totale des lots", heldBatches: "Lots bloqués ou expirés", nearExpiry: "Lots expirant sous 30 jours", printError: "Impossible d’ouvrir la fenêtre d’impression. Autorisez les fenêtres surgissantes.", pdfError: "Impossible de créer le PDF du rapport de stock." },
  en: { eyebrow: "Commerce & inventory", title: "Inventory reports", description: "Printable summary of organization quantities, batches, and inventory states.", ready: "Data ready to print", loading: "Loading report data…", empty: "No inventory data is available for export yet.", pdf: "Save PDF", print: "Print report", refresh: "Refresh", generated: "Report generated", amount: "Total available quantity", products: "Total products", activeProducts: "Active products", warehouses: "Warehouses", batches: "Batches", availableQuantity: "Total batch quantity", heldBatches: "Held or expired batches", nearExpiry: "Batches expiring within 30 days", printError: "Could not open the print window. Allow pop-ups and try again.", pdfError: "Could not create the inventory report PDF." },
} as const;

export default function InventoryReports() {
  const { language, direction, formatNumber } = useLanguage();
  const labels = copy[language];
  const products = trpc.erp.inventory.listProducts.useQuery(undefined, { retry: false });
  const warehouses = trpc.erp.inventory.listWarehouses.useQuery(undefined, { retry: false });
  const batches = trpc.erp.inventory.listBatches.useQuery(undefined, { retry: false });
  const isLoading = products.isLoading || warehouses.isLoading || batches.isLoading;
  const isError = products.isError || warehouses.isError || batches.isError;
  const reportRows = useMemo(() => {
    const productRows = products.data ?? [];
    const batchRows = batches.data ?? [];
    const threshold = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const availableQuantity = batchRows.reduce((total, batch) => total + Number(batch.currentQuantity ?? 0), 0);
    const heldBatches = batchRows.filter(batch => ["blocked", "quarantined", "expired"].includes(batch.status)).length;
    const nearExpiry = batchRows.filter(batch => batch.expiryDate && new Date(batch.expiryDate).getTime() >= Date.now() && new Date(batch.expiryDate).getTime() <= threshold).length;
    return [
      { label: labels.products, value: formatNumber(productRows.length) },
      { label: labels.activeProducts, value: formatNumber(productRows.filter(product => product.status === "active").length) },
      { label: labels.warehouses, value: formatNumber((warehouses.data ?? []).length) },
      { label: labels.batches, value: formatNumber(batchRows.length) },
      { label: labels.availableQuantity, value: formatNumber(availableQuantity) },
      { label: labels.heldBatches, value: formatNumber(heldBatches) },
      { label: labels.nearExpiry, value: formatNumber(nearExpiry) },
    ];
  }, [batches.data, formatNumber, labels, products.data, warehouses.data]);
  const isReportReady = !isLoading && !isError && Boolean((products.data?.length ?? 0) || (warehouses.data?.length ?? 0) || (batches.data?.length ?? 0));
  const reportData: DocumentPreviewExportData = useMemo(() => ({ direction, title: labels.title, date: `${labels.generated}: ${new Date().toLocaleDateString(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US")}`, documentLabel: labels.ready, amount: reportRows.find(row => row.label === labels.availableQuantity)?.value ?? "0", rows: reportRows, fontFamily: "noto-arabic", paperSize: "A4" }), [direction, labels, language, reportRows]);
  const refresh = () => void Promise.all([products.refetch(), warehouses.refetch(), batches.refetch()]);
  const savePdf = async () => { try { await downloadDistributionPdf(reportData, `raseen-inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`); } catch { toast.error(labels.pdfError); } };
  const printReport = () => { const popup = window.open("", "_blank"); if (!popup) { toast.error(labels.printError); return; } popup.opener = null; popup.document.write(buildDocumentPreviewHtml(reportData)); popup.document.close(); popup.addEventListener("load", () => popup.print(), { once: true }); };
  return <DashboardLayout><main dir={direction} className="mx-auto w-full max-w-6xl space-y-6"><header className="surface flex flex-col gap-5 rounded-3xl border p-6 md:flex-row md:items-end md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Boxes className="h-6 w-6" /></div><div><p className="text-sm text-primary">{labels.eyebrow}</p><h1 className="mt-1 text-2xl font-bold text-foreground">{labels.title}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{labels.description}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="icon" aria-label={labels.refresh} title={labels.refresh} onClick={refresh} disabled={isLoading}><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></Button><Button variant="outline" onClick={printReport} disabled={!isReportReady} className="gap-2"><Printer className="h-4 w-4" />{labels.print}</Button><Button onClick={() => void savePdf()} disabled={!isReportReady} className="gap-2"><Download className="h-4 w-4" />{labels.pdf}</Button></div></header><Card className="overflow-hidden"><CardHeader className="flex flex-row items-center justify-between border-b border-border/70"><CardTitle className="text-base">{labels.title}</CardTitle><span className="text-xs text-muted-foreground">{isReportReady ? labels.ready : labels.loading}</span></CardHeader><CardContent className="p-0">{isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : isError ? <div className="grid min-h-64 place-items-center gap-3 p-6 text-center"><p className="text-sm text-destructive">{labels.empty}</p><Button variant="outline" onClick={refresh}>{labels.refresh}</Button></div> : !isReportReady ? <div className="grid min-h-64 place-items-center p-6 text-center text-sm text-muted-foreground">{labels.empty}</div> : <dl className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0" dir={direction}>{reportRows.map(row => <div key={row.label} className="flex items-center justify-between gap-4 p-5"><dt className="text-sm text-muted-foreground">{row.label}</dt><dd className="text-lg font-bold text-foreground">{row.value}</dd></div>)}</dl>}</CardContent></Card></main></DashboardLayout>;
}
