import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLogs, businessParties, distributionCollections, employees, organizations, salesInvoices } from "../drizzle/schema";
import { commissionEntries, commissionRules } from "../drizzle/hrPayrollSchema";
import { getDb } from "./db";
import { createCollectionCommissionFromDistributionReceipt, createSalesCommissionFromIssuedInvoice } from "./payroll";

let organizationId: number | null = null;
afterEach(async () => {
  if (!organizationId) return;
  const db = await getDb(); if (!db) return;
  const id = organizationId;
  await db.delete(auditLogs).where(eq(auditLogs.organizationId, id));
  await db.delete(commissionEntries).where(eq(commissionEntries.organizationId, id));
  await db.delete(commissionRules).where(eq(commissionRules.organizationId, id));
  await db.delete(distributionCollections).where(eq(distributionCollections.organizationId, id));
  await db.delete(salesInvoices).where(eq(salesInvoices.organizationId, id));
  await db.delete(businessParties).where(eq(businessParties.organizationId, id));
  await db.delete(employees).where(eq(employees.organizationId, id));
  await db.delete(organizations).where(eq(organizations.id, id));
  organizationId = null;
});

describe("عمولة المبيعات التلقائية", () => {
  it("تنشئ عمولة مرة واحدة فقط من فاتورة مؤكدة مرتبطة بمندوب موظف موثوق وتتجاهل الغياب الآمن للإسناد", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const org = await db.insert(organizations).values({ name: `عمولة مبيعات ${suffix}`, slug: `sales-commission-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(org[0].insertId);
    const employee = await db.insert(employees).values({ organizationId, fullName: "مندوب موثوق", employeeNumber: `REP-${suffix}`, status: "active" });
    const employeeId = Number(employee[0].insertId);
    const customer = await db.insert(businessParties).values({ organizationId, name: "عميل عمولة", types: ["customer"], assignedRepresentativeEmployeeId: employeeId, status: "active" });
    const customerId = Number(customer[0].insertId);
    await db.insert(commissionRules).values({ organizationId, name: "عمولة مبيعات 10%", sourceType: "sales", calculationType: "percentage", value: "10", status: "active" });
    const invoice = await db.insert(salesInvoices).values({ organizationId, customerId, invoiceNumber: `INV-COMM-${suffix}`, status: "issued", grandTotal: "1500", currencyCode: "SAR", issuedAt: new Date("2026-08-16T00:00:00Z") });
    const invoiceId = Number(invoice[0].insertId);
    const first = await createSalesCommissionFromIssuedInvoice(organizationId, 1, invoiceId);
    const duplicate = await createSalesCommissionFromIssuedInvoice(organizationId, 1, invoiceId);
    const entries = await db.select().from(commissionEntries).where(eq(commissionEntries.organizationId, organizationId));
    expect(first).toMatchObject({ created: true, amount: 150 });
    expect(duplicate).toMatchObject({ created: false, reason: "duplicate_source" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ employeeId, sourceModule: "sales", sourceDocumentType: "sales_invoice", sourceDocumentId: invoiceId, amount: "150.00", status: "approved" });
    const unattributed = await db.insert(salesInvoices).values({ organizationId, invoiceNumber: `INV-NO-REP-${suffix}`, status: "issued", grandTotal: "100", currencyCode: "SAR", issuedAt: new Date("2026-08-16T00:00:00Z") });
    await expect(createSalesCommissionFromIssuedInvoice(organizationId, 1, Number(unattributed[0].insertId))).resolves.toMatchObject({ created: false, reason: "invoice_not_eligible" });
  });

  it("ينشئ عمولة من مبلغ التحصيل الفعلي مرة واحدة فقط للمندوب المسجل في الإيصال", async () => {
    const db = await getDb(); expect(db).toBeTruthy(); if (!db) return;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const org = await db.insert(organizations).values({ name: `تحصيل عمولة ${suffix}`, slug: `collection-commission-${suffix}`, status: "active", baseCurrency: "SAR", locale: "ar-SA", monthlyBudget: "0" });
    organizationId = Number(org[0].insertId);
    const employee = await db.insert(employees).values({ organizationId, fullName: "مندوب تحصيل", employeeNumber: `COL-${suffix}`, status: "active" });
    const employeeId = Number(employee[0].insertId);
    await db.insert(commissionRules).values({ organizationId, name: "عمولة تحصيل 5%", sourceType: "collections", calculationType: "percentage", value: "5", status: "active" });
    const receipt = await db.insert(distributionCollections).values({ organizationId, receiptNumber: `RC-${suffix}`, routeId: 1, customerId: 1, representativeEmployeeId: employeeId, collectionType: "current_invoice", amount: "800", currencyCode: "SAR", idempotencyKey: `collection-${suffix}` });
    const collectionId = Number(receipt[0].insertId);
    const first = await createCollectionCommissionFromDistributionReceipt(organizationId, 1, collectionId);
    const duplicate = await createCollectionCommissionFromDistributionReceipt(organizationId, 1, collectionId);
    const entries = await db.select().from(commissionEntries).where(eq(commissionEntries.organizationId, organizationId));
    expect(first).toMatchObject({ created: true, amount: 40 });
    expect(duplicate).toMatchObject({ created: false, reason: "duplicate_source" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ employeeId, sourceDocumentType: "distribution_collection", sourceDocumentId: collectionId, amount: "40.00" });
  });
});
