import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildCustomerEmailUrl, buildInvoiceClientShareMessage, buildWhatsAppCustomerUrl, createSalesInvoicePdf, downloadPdfResult, downloadSalesInvoicePdf } from "@/lib/salesInvoicePdfExport";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Download, FileText, Loader2, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useLocation } from "wouter";

const sectionLabels = {
  products: { ar: "المنتج", fr: "Produit", en: "Product" },
  warehouses: { ar: "المخزن", fr: "Entrepôt", en: "Warehouse" },
  batches: { ar: "الدفعة", fr: "Lot", en: "Batch" },
  sales: { ar: "فاتورة المبيعات", fr: "Facture de vente", en: "Sales invoice" },
  purchases: { ar: "أمر الشراء", fr: "Commande d’achat", en: "Purchase order" },
} as const;

function printable(value: unknown, formatDate: (value: Date | string | number) => string) {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))) return formatDate(value as Date | string);
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const fieldLabels: Record<string, { ar: string; fr: string; en: string }> = {
  id: { ar: "المعرّف", fr: "Identifiant", en: "ID" }, productId: { ar: "معرّف المنتج", fr: "Identifiant produit", en: "Product ID" }, warehouseId: { ar: "معرّف المخزن", fr: "Identifiant entrepôt", en: "Warehouse ID" }, sourcePartyId: { ar: "معرّف المورد", fr: "Identifiant fournisseur", en: "Supplier ID" }, lotNumber: { ar: "رقم الدفعة", fr: "Numéro de lot", en: "Lot number" }, receivedQuantity: { ar: "الكمية المستلمة", fr: "Quantité reçue", en: "Received quantity" }, reservedQuantity: { ar: "الكمية المحجوزة", fr: "Quantité réservée", en: "Reserved quantity" }, currentQuantity: { ar: "الكمية الحالية", fr: "Quantité actuelle", en: "Current quantity" }, manufacturingDate: { ar: "تاريخ التصنيع", fr: "Date de fabrication", en: "Manufacturing date" }, expiryDate: { ar: "تاريخ الصلاحية", fr: "Date d’expiration", en: "Expiry date" }, cost: { ar: "التكلفة", fr: "Coût", en: "Cost" }, status: { ar: "الحالة", fr: "Statut", en: "Status" }, name: { ar: "الاسم", fr: "Nom", en: "Name" }, sku: { ar: "رمز SKU", fr: "SKU", en: "SKU" }, salePrice: { ar: "سعر البيع", fr: "Prix de vente", en: "Sale price" }, purchasePrice: { ar: "سعر الشراء", fr: "Prix d’achat", en: "Purchase price" }, minimumStock: { ar: "الحد الأدنى للمخزون", fr: "Stock minimum", en: "Minimum stock" }, reorderPoint: { ar: "نقطة إعادة الطلب", fr: "Point de commande", en: "Reorder point" }, invoiceNumber: { ar: "رقم الفاتورة", fr: "Numéro de facture", en: "Invoice number" }, orderNumber: { ar: "رقم أمر الشراء", fr: "Numéro de commande", en: "Purchase order number" }, netAmount: { ar: "الصافي قبل الضريبة", fr: "Net hors taxe", en: "Net before tax" }, taxAmount: { ar: "قيمة الضريبة", fr: "Montant de TVA", en: "Tax amount" }, taxMode: { ar: "طريقة عرض السعر", fr: "Mode de prix", en: "Price mode" }, discountAmount: { ar: "الخصم", fr: "Remise", en: "Discount" }, grandTotal: { ar: "الإجمالي", fr: "Total", en: "Grand total" }, dueDate: { ar: "تاريخ الاستحقاق", fr: "Date d’échéance", en: "Due date" }, expectedAt: { ar: "تاريخ الاستلام المتوقع", fr: "Réception prévue", en: "Expected receipt" }, currencyCode: { ar: "العملة", fr: "Devise", en: "Currency" }, notes: { ar: "ملاحظات", fr: "Notes", en: "Notes" }, description: { ar: "الوصف", fr: "Description", en: "Description" }, code: { ar: "الرمز", fr: "Code", en: "Code" }, isMobile: { ar: "مخزن متنقل", fr: "Entrepôt mobile", en: "Mobile warehouse" },
};

function humanizeField(key: string, language: "ar" | "fr" | "en") {
  return fieldLabels[key]?.[language] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default function CommerceRecordDetail() {
  const { language, direction, formatCurrency, formatDate, t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [sharingChannel, setSharingChannel] = useState<"whatsapp" | "email" | null>(null);
  const [, , section = "products", rawId] = location.split("/");
  const id = Number(rawId);
  const safeSection = section in sectionLabels ? section as keyof typeof sectionLabels : "products";
  const products = trpc.erp.inventory.listProducts.useQuery(undefined, { retry: false });
  const warehouses = trpc.erp.inventory.listWarehouses.useQuery(undefined, { retry: false });
  const batches = trpc.erp.inventory.listBatches.useQuery(undefined, { retry: false });
  const invoices = trpc.erp.sales.listInvoices.useQuery(undefined, { retry: false });
  const invoicePrintData = trpc.erp.sales.invoicePrintData.useQuery({ invoiceId: id }, { enabled: safeSection === "sales" && Number.isInteger(id) && id > 0, retry: false });
  const orders = trpc.erp.purchases.listOrders.useQuery(undefined, { retry: false });
  const source = safeSection === "products" ? products : safeSection === "warehouses" ? warehouses : safeSection === "batches" ? batches : safeSection === "sales" ? invoices : orders;
  const record = (source.data ?? []).find((item: any) => Number(item.id) === id) as Record<string, unknown> | undefined;
  const label = sectionLabels[safeSection][language];
  const copy = language === "ar" ? { back: "العودة إلى الجدول", details: "تفاصيل السجل", missing: "لم يُعثر على هذا السجل أو لا تملك صلاحية قراءته.", reload: "إعادة المحاولة", identifier: "معرّف السجل", downloadPdf: "تنزيل PDF رسمي", pdfError: "تعذر إنشاء ملف PDF للفاتورة.", whatsapp: "واتساب العميل", email: "بريد العميل", missingWhatsApp: "رقم واتساب العميل غير متاح أو ليس بالصيغة الدولية.", missingEmail: "بريد العميل غير متاح أو غير صالح.", handoff: "تم تنزيل PDF وفتح التطبيق لإرسال الفاتورة. أرفق الملف في الرسالة قبل الإرسال.", shareError: "تعذر تجهيز مشاركة الفاتورة." } : language === "fr" ? { back: "Retour au tableau", details: "Détails de l’enregistrement", missing: "Enregistrement introuvable ou accès non autorisé.", reload: "Réessayer", identifier: "Identifiant", downloadPdf: "Télécharger le PDF officiel", pdfError: "Impossible de créer le PDF de la facture.", whatsapp: "WhatsApp client", email: "E-mail client", missingWhatsApp: "Le numéro WhatsApp du client est indisponible ou non international.", missingEmail: "L’e-mail du client est indisponible ou invalide.", handoff: "Le PDF est téléchargé et l’application d’envoi est ouverte. Joignez le fichier avant l’envoi.", shareError: "Préparation du partage de facture impossible." } : { back: "Back to table", details: "Record details", missing: "Record not found or you do not have access.", reload: "Retry", identifier: "Record ID", downloadPdf: "Download official PDF", pdfError: "Unable to create the invoice PDF.", whatsapp: "Customer WhatsApp", email: "Customer email", missingWhatsApp: "The customer WhatsApp number is unavailable or not in international format.", missingEmail: "The customer email is unavailable or invalid.", handoff: "The PDF was downloaded and the sending app is open. Attach the file before sending.", shareError: "Unable to prepare invoice sharing." };
  const heading = record?.name ?? record?.nameAr ?? record?.lotNumber ?? record?.invoiceNumber ?? record?.orderNumber ?? `${label} #${id}`;
  const fields = record ? Object.entries(record).filter(([key]) => !["organizationId", "createdAt", "updatedAt"].includes(key)) : [];
  const formatFieldValue = (key: string, value: unknown) => {
    if (["netAmount", "taxAmount", "discountAmount", "grandTotal", "amountPaid"].includes(key)) return formatCurrency(Number(value));
    if (key === "taxMode") return value === "inclusive" ? (language === "ar" ? "شامل الضريبة" : language === "fr" ? "TTC" : "Tax inclusive") : (language === "ar" ? "غير شامل الضريبة" : language === "fr" ? "Hors taxe" : "Tax exclusive");
    return printable(value, formatDate);
  };
  const exportInvoicePdf = async () => {
    if (!invoicePrintData.data) return;
    try { await downloadSalesInvoicePdf(invoicePrintData.data, language); }
    catch { toast.error(copy.pdfError); }
  };
  const handOffInvoice = async (channel: "whatsapp" | "email") => {
    if (!invoicePrintData.data) return;
    const message = buildInvoiceClientShareMessage(invoicePrintData.data, language);
    const destination = channel === "whatsapp" ? buildWhatsAppCustomerUrl(invoicePrintData.data.customerPhone, message) : buildCustomerEmailUrl(invoicePrintData.data.customerEmail, `${language === "ar" ? "فاتورة" : language === "fr" ? "Facture" : "Invoice"} ${invoicePrintData.data.invoice.invoiceNumber} — ${invoicePrintData.data.organizationName}`, message);
    if (!destination) { toast.error(channel === "whatsapp" ? copy.missingWhatsApp : copy.missingEmail); return; }
    setSharingChannel(channel);
    try {
      downloadPdfResult(await createSalesInvoicePdf(invoicePrintData.data, language));
      const anchor = document.createElement("a");
      anchor.href = destination;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
      toast.success(copy.handoff);
    } catch { toast.error(copy.shareError); }
    finally { setSharingChannel(null); }
  };
  const shareDisabled = invoicePrintData.isLoading || !invoicePrintData.data || sharingChannel !== null;
  return <DashboardLayout><main dir={direction} className="mx-auto max-w-5xl space-y-6"><header className="surface flex flex-col gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><FileText className="h-6 w-6" /></div><div><p className="text-sm text-primary">{label}</p><h1 className="mt-1 text-2xl font-bold text-foreground">{String(heading)}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.details} · {copy.identifier}: {id}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setLocation(`/commerce/${safeSection}`)}><ArrowRight className="me-2 h-4 w-4" />{copy.back}</Button>{safeSection === "sales" ? <><Button onClick={() => void exportInvoicePdf()} disabled={shareDisabled} className="gap-2"><Download className="h-4 w-4" />{invoicePrintData.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{copy.downloadPdf}</Button><Button variant="outline" onClick={() => void handOffInvoice("whatsapp")} disabled={shareDisabled} className="gap-2"><MessageCircle className="h-4 w-4" />{sharingChannel === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{copy.whatsapp}</Button><Button variant="outline" onClick={() => void handOffInvoice("email")} disabled={shareDisabled} className="gap-2"><Mail className="h-4 w-4" />{sharingChannel === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{copy.email}</Button></> : null}</div></header>{source.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : source.isError ? <Card><CardContent className="grid min-h-52 place-items-center gap-3 p-8"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => source.refetch()}><RefreshCw className="me-2 h-4 w-4" />{copy.reload}</Button></CardContent></Card> : !record ? <Card><CardContent className="grid min-h-52 place-items-center p-8 text-sm text-muted-foreground">{copy.missing}</CardContent></Card> : <Card className="overflow-hidden"><CardHeader className="border-b border-border/70"><CardTitle className="flex items-center justify-between text-base"><span>{copy.details}</span>{record.status ? <Badge variant="outline">{String(record.status)}</Badge> : null}</CardTitle></CardHeader><CardContent className="grid gap-px bg-border/60 p-px sm:grid-cols-2">{fields.map(([key, value]) => <div key={key} className="min-w-0 bg-background p-4"><p className="text-xs text-muted-foreground">{humanizeField(key, language)}</p><p className="mt-2 break-words text-sm font-medium text-foreground">{formatFieldValue(key, value)}</p></div>)}</CardContent></Card>}</main></DashboardLayout>;
}
