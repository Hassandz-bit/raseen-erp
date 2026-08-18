import { createDocumentPreviewPdf, type DocumentPreviewExportData } from "./documentPreviewExport";

type AppLanguage = "ar" | "fr" | "en";

export type SalesInvoicePrintData = {
  organizationName: string;
  customerName: string | null;
  documentSettings: { logoUrl?: string; headerText?: string; footerText?: string; showSignature?: boolean; fontFamily?: DocumentPreviewExportData["fontFamily"]; fontSize?: DocumentPreviewExportData["fontSize"]; paperSize?: DocumentPreviewExportData["paperSize"] } | null;
  invoice: { invoiceNumber: string; status: string; currencyCode: string; taxMode: "exclusive" | "inclusive"; netAmount: string | number; taxAmount: string | number; discountAmount: string | number; grandTotal: string | number; dueDate: Date | string | null; createdAt: Date | string };
  items: Array<{ id: number; productName: string; sku: string | null; quantity: string | number; unit: string; unitPrice: string | number; taxRate: string | number; lineTotal: string | number }>;
};

const copy = {
  ar: { title: "فاتورة ضريبية", invoice: "رقم الفاتورة", customer: "العميل", status: "الحالة", created: "تاريخ الإنشاء", due: "تاريخ الاستحقاق", priceMode: "طريقة عرض السعر", inclusive: "شامل الضريبة", exclusive: "غير شامل الضريبة", items: "تفاصيل البنود", net: "صافي المبلغ", tax: "ضريبة القيمة المضافة", discount: "الخصم", total: "الإجمالي المستحق", signature: "ختم وتوقيع الجهة المصدرة", footer: "هذه فاتورة صادرة من نظام رصين." },
  fr: { title: "Facture fiscale", invoice: "Numéro de facture", customer: "Client", status: "Statut", created: "Date de création", due: "Date d’échéance", priceMode: "Mode de prix", inclusive: "TTC", exclusive: "Hors taxe", items: "Détail des lignes", net: "Montant net", tax: "TVA", discount: "Remise", total: "Total dû", signature: "Cachet et signature de l’émetteur", footer: "Facture émise depuis RASEEN ERP." },
  en: { title: "Tax invoice", invoice: "Invoice number", customer: "Customer", status: "Status", created: "Created on", due: "Due date", priceMode: "Price mode", inclusive: "Tax inclusive", exclusive: "Tax exclusive", items: "Line items", net: "Net amount", tax: "VAT", discount: "Discount", total: "Total due", signature: "Issuer stamp and signature", footer: "Invoice issued from RASEEN ERP." },
} as const;

function locale(language: AppLanguage) { return language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US"; }
function money(value: string | number, currency: string, language: AppLanguage) { return new Intl.NumberFormat(locale(language), { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)); }
function date(value: Date | string, language: AppLanguage) { return new Intl.DateTimeFormat(locale(language), { dateStyle: "medium" }).format(new Date(value)); }

export function buildSalesInvoicePdfInput(data: SalesInvoicePrintData, language: AppLanguage): DocumentPreviewExportData {
  const text = copy[language];
  const settings = data.documentSettings ?? {};
  const currency = data.invoice.currencyCode;
  const itemRows = data.items.flatMap((item, index) => [
    { label: `${text.items} ${index + 1}: ${item.productName}${item.sku ? ` (${item.sku})` : ""}`, value: `${item.quantity} ${item.unit} × ${money(item.unitPrice, currency, language)}` },
    { label: `${text.tax} ${Number(item.taxRate)}%`, value: money(item.lineTotal, currency, language) },
  ]);
  return {
    direction: language === "ar" ? "rtl" : "ltr",
    logoUrl: settings.logoUrl,
    title: `${text.title} — ${data.organizationName}`,
    date: `${text.created}: ${date(data.invoice.createdAt, language)}`,
    documentLabel: `${text.invoice}: ${data.invoice.invoiceNumber}`,
    amount: money(data.invoice.grandTotal, currency, language),
    rows: [
      { label: text.customer, value: data.customerName || "—" },
      { label: text.status, value: data.invoice.status },
      { label: text.priceMode, value: data.invoice.taxMode === "inclusive" ? text.inclusive : text.exclusive },
      ...(data.invoice.dueDate ? [{ label: text.due, value: date(data.invoice.dueDate, language) }] : []),
      ...itemRows,
      { label: text.net, value: money(data.invoice.netAmount, currency, language) },
      { label: text.tax, value: money(data.invoice.taxAmount, currency, language) },
      ...(Number(data.invoice.discountAmount) > 0 ? [{ label: text.discount, value: money(data.invoice.discountAmount, currency, language) }] : []),
      { label: text.total, value: money(data.invoice.grandTotal, currency, language) },
    ],
    footer: settings.footerText?.trim() || text.footer,
    signatureLabel: settings.showSignature === false ? undefined : text.signature,
    fontFamily: settings.fontFamily ?? (language === "ar" ? "noto-arabic" : "inter"),
    fontSize: settings.fontSize ?? "normal",
    paperSize: settings.paperSize ?? "A4",
  };
}

export async function downloadSalesInvoicePdf(data: SalesInvoicePrintData, language: AppLanguage) {
  const result = await createDocumentPreviewPdf(buildSalesInvoicePdfInput(data, language), `raseen-invoice-${data.invoice.invoiceNumber}.pdf`);
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
