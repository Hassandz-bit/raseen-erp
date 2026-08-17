import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type RetailerReportOrder = { orderNumber: string; status: string; paymentStatus: string; totalAmount: string | number; currencyCode: string; createdAt: Date | string };
export type RetailerReportInvoice = { invoiceNumber: string; status: string; grandTotal: string | number; amountPaid: string | number; currencyCode: string; issuedAt: Date | string | null };
export type RetailerMonthlyReportExport = { period: { month: number; year: number }; currencyCode: string; summary: { orderCount: number; orderTotal: number; invoiceCount: number; invoicedTotal: number; outstandingBalance: number }; orders: RetailerReportOrder[]; invoices: RetailerReportInvoice[] };

const date = (value: Date | string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function buildRetailerReportCsv(report: RetailerMonthlyReportExport) {
  const lines = [
    ["Nawa Retail monthly report", `${report.period.year}-${String(report.period.month).padStart(2, "0")}`],
    ["Currency", report.currencyCode],
    ["Order count", report.summary.orderCount],
    ["Order total", report.summary.orderTotal],
    ["Invoice count", report.summary.invoiceCount],
    ["Invoiced total", report.summary.invoicedTotal],
    ["Outstanding balance", report.summary.outstandingBalance],
    [],
    ["Order number", "Status", "Payment status", "Total", "Currency", "Created at"],
    ...report.orders.map(order => [order.orderNumber, order.status, order.paymentStatus, order.totalAmount, order.currencyCode, date(order.createdAt)]),
    [],
    ["Invoice number", "Status", "Grand total", "Amount paid", "Outstanding", "Currency", "Issued at"],
    ...report.invoices.map(invoice => [invoice.invoiceNumber, invoice.status, invoice.grandTotal, invoice.amountPaid, Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid)), invoice.currencyCode, date(invoice.issuedAt)]),
  ];
  return `\ufeff${lines.map(line => line.map(csv).join(",")).join("\n")}`;
}

export async function buildRetailerReportPdf(report: RetailerMonthlyReportExport) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([842, 595]);
  page.drawText("Nawa Retail — Monthly report", { x: 42, y: 550, size: 18, font: bold, color: rgb(.12, .16, .22) });
  page.drawText(`Period: ${report.period.year}-${String(report.period.month).padStart(2, "0")}  |  Currency: ${report.currencyCode}`, { x: 42, y: 528, size: 10, font });
  page.drawText(`Orders: ${report.summary.orderCount} (${report.summary.orderTotal})   Invoices: ${report.summary.invoiceCount} (${report.summary.invoicedTotal})   Outstanding: ${report.summary.outstandingBalance}`, { x: 42, y: 507, size: 10, font });
  page.drawText("Orders", { x: 42, y: 478, size: 12, font: bold });
  page.drawText("Number                         Status                 Payment          Total          Date", { x: 42, y: 462, size: 9, font: bold });
  report.orders.slice(0, 14).forEach((order, index) => page.drawText(`${order.orderNumber.padEnd(31)}${order.status.padEnd(23)}${order.paymentStatus.padEnd(17)}${String(order.totalAmount).padEnd(15)}${date(order.createdAt)}`, { x: 42, y: 446 - index * 14, size: 8, font }));
  const invoiceStart = 446 - Math.min(report.orders.length, 14) * 14 - 22;
  page.drawText("Invoices", { x: 42, y: invoiceStart, size: 12, font: bold });
  page.drawText("Number                         Status                 Total          Paid           Outstanding     Date", { x: 42, y: invoiceStart - 16, size: 9, font: bold });
  report.invoices.slice(0, 10).forEach((invoice, index) => page.drawText(`${invoice.invoiceNumber.padEnd(31)}${invoice.status.padEnd(23)}${String(invoice.grandTotal).padEnd(15)}${String(invoice.amountPaid).padEnd(15)}${String(Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid))).padEnd(16)}${date(invoice.issuedAt)}`, { x: 42, y: invoiceStart - 32 - index * 14, size: 8, font }));
  return pdf.save();
}
