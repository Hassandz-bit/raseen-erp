import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auditLogs, products, salesInvoiceItems, salesInvoices, warehouses, organizations } from "../drizzle/schema";
import { createSalesInvoice, getDb, getSalesInvoicePrintDataForOrganization } from "./db";

type Fixture = { organizationId: number; productId: number; warehouseId: number };
let fixture: Fixture | null = null;

async function createFixture(salePrice: string) {
  const db = await getDb();
  expect(db).toBeTruthy();
  if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const organization = await db.insert(organizations).values({ name: `اختبار ضريبة ${suffix}`, slug: `vat-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
  const organizationId = Number(organization[0].insertId);
  const product = await db.insert(products).values({ organizationId, name: "منتج اختبار ضريبة", sku: `VAT-${suffix}`, baseUnit: "قطعة", unit: "قطعة", purchaseUnit: "قطعة", salesUnit: "قطعة", salePrice, taxRate: "0", status: "active" });
  const productId = Number(product[0].insertId);
  const warehouse = await db.insert(warehouses).values({ organizationId, name: "مخزن اختبار ضريبة", code: `VAT-WH-${suffix}`, status: "active" });
  const warehouseId = Number(warehouse[0].insertId);
  fixture = { organizationId, productId, warehouseId };
  return fixture;
}

afterEach(async () => {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;
  const { organizationId, productId, warehouseId } = fixture;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
  await db.delete(salesInvoiceItems).where(eq(salesInvoiceItems.organizationId, organizationId));
  await db.delete(salesInvoices).where(eq(salesInvoices.organizationId, organizationId));
  await db.delete(warehouses).where(and(eq(warehouses.organizationId, organizationId), eq(warehouses.id, warehouseId)));
  await db.delete(products).where(and(eq(products.organizationId, organizationId), eq(products.id, productId)));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  fixture = null;
});

describe("حساب ضريبة القيمة المضافة في فواتير المبيعات", () => {
  it("يحافظ على صافي وإجمالي متطابقين عند ضبط الضريبة على 0%", async () => {
    const { organizationId, productId, warehouseId } = await createFixture("100");
    const result = await createSalesInvoice(organizationId, 1, { currencyCode: "SAR", baseCurrencyCode: "SAR", taxMode: "exclusive", taxRate: 0, lines: [{ productId, warehouseId, quantity: 1, unit: "قطعة" }] });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const [invoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.id, result.id))).limit(1);

    expect(result).toMatchObject({ taxMode: "exclusive", netAmount: 100, taxAmount: 0, grandTotal: 100 });
    expect(invoice).toMatchObject({ netAmount: "100.00", taxAmount: "0.00", grandTotal: "100.00" });
  });

  it("يحسب السعر غير الشامل كصافي ثم ضريبة ثم إجمالي على الخادم", async () => {
    const { organizationId, productId, warehouseId } = await createFixture("100");
    const result = await createSalesInvoice(organizationId, 1, { currencyCode: "SAR", baseCurrencyCode: "SAR", taxMode: "exclusive", taxRate: 19, lines: [{ productId, warehouseId, quantity: 1, unit: "قطعة" }] });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const [invoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.id, result.id))).limit(1);
    const [item] = await db.select().from(salesInvoiceItems).where(and(eq(salesInvoiceItems.organizationId, organizationId), eq(salesInvoiceItems.invoiceId, result.id))).limit(1);

    expect(result).toMatchObject({ taxMode: "exclusive", netAmount: 100, taxAmount: 19, grandTotal: 119 });
    expect(invoice).toMatchObject({ taxMode: "exclusive", netAmount: "100.00", taxAmount: "19.00", grandTotal: "119.00" });
    expect(Number(item?.taxRate)).toBe(19);
    expect(Number(item?.lineTotal)).toBe(119);
  });

  it("يفصل السعر الشامل إلى صافي وضريبة من دون رفع إجمالي الفاتورة", async () => {
    const { organizationId, productId, warehouseId } = await createFixture("119");
    const result = await createSalesInvoice(organizationId, 1, { currencyCode: "SAR", baseCurrencyCode: "SAR", taxMode: "inclusive", taxRate: 19, lines: [{ productId, warehouseId, quantity: 1, unit: "قطعة" }] });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const [invoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.organizationId, organizationId), eq(salesInvoices.id, result.id))).limit(1);
    const [item] = await db.select().from(salesInvoiceItems).where(and(eq(salesInvoiceItems.organizationId, organizationId), eq(salesInvoiceItems.invoiceId, result.id))).limit(1);

    expect(result).toMatchObject({ taxMode: "inclusive", netAmount: 100, taxAmount: 19, grandTotal: 119 });
    expect(invoice).toMatchObject({ taxMode: "inclusive", netAmount: "100.00", taxAmount: "19.00", grandTotal: "119.00" });
    expect(Number(item?.unitPrice)).toBe(119);
    expect(Number(item?.lineTotal)).toBe(119);
  });

  it("يعيد بيانات طباعة الفاتورة وأسطرها ضمن المؤسسة المالكة فقط", async () => {
    const { organizationId, productId, warehouseId } = await createFixture("100");
    const created = await createSalesInvoice(organizationId, 1, { invoiceNumber: "VAT-PRINT-001", currencyCode: "SAR", baseCurrencyCode: "SAR", taxMode: "exclusive", taxRate: 19, lines: [{ productId, warehouseId, quantity: 2, unit: "قطعة" }] });

    const printData = await getSalesInvoicePrintDataForOrganization(organizationId, created.id);

    expect(printData.invoice).toMatchObject({ invoiceNumber: "VAT-PRINT-001", taxMode: "exclusive", netAmount: "200.00", taxAmount: "38.00", grandTotal: "238.00" });
    expect(printData.items).toEqual([expect.objectContaining({ productName: "منتج اختبار ضريبة", quantity: "2.000", unit: "قطعة", taxRate: "19.0000", lineTotal: "238.00" })]);
    await expect(getSalesInvoicePrintDataForOrganization(organizationId + 999_999, created.id)).rejects.toThrow("لم يتم العثور على الفاتورة ضمن المؤسسة الحالية");
  });
}, 20_000);
