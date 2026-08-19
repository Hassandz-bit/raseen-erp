import QRCode from "qrcode";
import { createDocumentPreviewPdf, type DocumentPreviewExportData } from "./documentPreviewExport";
import { getInvoiceShareTemplate, renderInvoiceShareTemplate, type ShareTemplateSet } from "./invoiceShareMessageTemplates";

export type AppLanguage = "ar" | "fr" | "en";

export type SalesInvoicePrintData = {
  organizationName: string;
  customerName: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  documentSettings: { logoUrl?: string; headerText?: string; footerText?: string; taxNumber?: string; legalInfo?: string; headerTemplate?: "classic" | "split" | "minimal"; showSignature?: boolean; useLogoWatermark?: boolean; showElectronicSeal?: boolean; electronicSealLabel?: string; shareTemplates?: ShareTemplateSet; fontFamily?: DocumentPreviewExportData["fontFamily"]; fontSize?: DocumentPreviewExportData["fontSize"]; paperSize?: DocumentPreviewExportData["paperSize"] } | null;
  invoice: { invoiceNumber: string; status: string; currencyCode: string; taxMode: "exclusive" | "inclusive"; netAmount: string | number; taxAmount: string | number; discountAmount: string | number; grandTotal: string | number; dueDate: Date | string | null; createdAt: Date | string };
  items: Array<{ id: number; productName: string; sku: string | null; quantity: string | number; unit: string; unitPrice: string | number; taxRate: string | number; lineTotal: string | number }>;
  verificationToken?: string;
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
    taxNumber: settings.taxNumber,
    legalInfo: settings.legalInfo,
    useLogoWatermark: settings.useLogoWatermark,
    headerTemplate: settings.headerTemplate,
    showElectronicSeal: settings.showElectronicSeal,
    electronicSealLabel: settings.electronicSealLabel,
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

export function buildInvoiceVerificationUrl(token: string | undefined) {
  if (!token || typeof window === "undefined") return undefined;
  const verificationUrl = new URL("/verify/invoice", window.location.origin);
  verificationUrl.searchParams.set("token", token);
  return verificationUrl.toString();
}

export function buildInvoiceClientShareMessage(data: SalesInvoicePrintData, language: AppLanguage) {
  const total = money(data.invoice.grandTotal, data.invoice.currencyCode, language);
  const verificationUrl = buildInvoiceVerificationUrl(data.verificationToken);
  const values = { organization_name: data.organizationName, customer_name: data.customerName || (language === "ar" ? "عميلنا" : language === "fr" ? "Client" : "Customer"), invoice_number: data.invoice.invoiceNumber, invoice_total: total, verification_url: verificationUrl ?? "" };
  return renderInvoiceShareTemplate(getInvoiceShareTemplate(data.documentSettings?.shareTemplates, "whatsapp", language), values);
}

export function buildInvoiceCustomerEmail(data: SalesInvoicePrintData, language: AppLanguage) {
  const total = money(data.invoice.grandTotal, data.invoice.currencyCode, language);
  const verificationUrl = buildInvoiceVerificationUrl(data.verificationToken);
  const values = { organization_name: data.organizationName, customer_name: data.customerName || (language === "ar" ? "عميلنا" : language === "fr" ? "Client" : "Customer"), invoice_number: data.invoice.invoiceNumber, invoice_total: total, verification_url: verificationUrl ?? "" };
  const templates = data.documentSettings?.shareTemplates;
  return { subject: renderInvoiceShareTemplate(getInvoiceShareTemplate(templates, "emailSubject", language), values), body: renderInvoiceShareTemplate(getInvoiceShareTemplate(templates, "emailBody", language), values) };
}

export function buildWhatsAppCustomerUrl(phone: string | null | undefined, message: string) {
  const raw = String(phone ?? "").trim();
  if (!raw.startsWith("+") && !raw.startsWith("00")) return undefined;
  const compact = raw.replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : compact.startsWith("00") ? compact.slice(2) : compact;
  if (!/^\d{8,15}$/.test(digits)) return undefined;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildCustomerEmailUrl(email: string | null | undefined, subject: string, body: string) {
  const recipient = String(email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return undefined;
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function downloadPdfResult(result: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function createSalesInvoicePdf(data: SalesInvoicePrintData, language: AppLanguage) {
  const input = buildSalesInvoicePdfInput(data, language);
  const verificationUrl = buildInvoiceVerificationUrl(data.verificationToken);
  if (verificationUrl) {
    input.verificationQrDataUrl = await QRCode.toDataURL(verificationUrl.toString(), { width: 160, margin: 1, errorCorrectionLevel: "M" });
    input.verificationLabel = language === "ar" ? "امسح للتحقق من صحة الفاتورة" : language === "fr" ? "Scannez pour vérifier la facture" : "Scan to verify invoice";
  }
  return createDocumentPreviewPdf(input, `raseen-invoice-${data.invoice.invoiceNumber}.pdf`);
}

export async function downloadSalesInvoicePdf(data: SalesInvoicePrintData, language: AppLanguage) {
  downloadPdfResult(await createSalesInvoicePdf(data, language));
}
