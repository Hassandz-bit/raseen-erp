import { describe, expect, it } from "vitest";
import { createOrganizationBackupEnvelope, getOrganizationBackupFilename, ORGANIZATION_BACKUP_TABLES, parseOrganizationBackup, restoreOrganizationBackup } from "./organizationBackup";

function payload() {
  const data = Object.fromEntries(ORGANIZATION_BACKUP_TABLES.map(table => [table, []]));
  const rowCounts = Object.fromEntries(ORGANIZATION_BACKUP_TABLES.map(table => [table, 0]));
  return {
    createdAt: "2026-08-25T12:00:00.000Z",
    source: { organizationId: 17, organizationName: "رصين للتجارة", fingerprint: "a".repeat(64) },
    data,
    rowCounts,
  };
}

describe("حزمة النسخ المحلي للمؤسسة", () => {
  it("تنشئ حزمة إصدار 1 متحققة وتعيد قراءتها", () => {
    const bundle = createOrganizationBackupEnvelope(payload());
    const parsed = parseOrganizationBackup(JSON.stringify(bundle));
    expect(parsed.integrity.algorithm).toBe("SHA-256");
    expect(parsed.integrity.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.payload.rowCounts.products).toBe(0);
  });

  it("يرفض أي تعديل في الصفوف بعد إنشاء البصمة", () => {
    const changedPayload = payload();
    changedPayload.data.products = [{ id: 99, organizationId: 17, sku: "SAFE" }];
    changedPayload.rowCounts.products = 1;
    const bundle = createOrganizationBackupEnvelope(changedPayload);
    const altered = JSON.parse(JSON.stringify(bundle));
    altered.payload.data.products[0].sku = "TAMPERED";
    expect(() => parseOrganizationBackup(JSON.stringify(altered))).toThrow("SHA-256");
  });

  it("يرفض الحزم الناقصة أو التي تطلب جدولا خارج نطاق النسخة", () => {
    const incomplete = payload();
    delete incomplete.data.products;
    const incompleteBundle = createOrganizationBackupEnvelope(incomplete);
    expect(() => parseOrganizationBackup(JSON.stringify(incompleteBundle))).toThrow("لا تحتوي جدول products");

    const unsafe = payload();
    unsafe.data.users = [];
    unsafe.rowCounts.users = 0;
    const unsafeBundle = createOrganizationBackupEnvelope(unsafe);
    expect(() => parseOrganizationBackup(JSON.stringify(unsafeBundle))).toThrow("غير مسموح");
  });

  it("لا يبدأ أي اتصال أو استبدال عندما تكون عبارة التأكيد خاطئة", async () => {
    await expect(restoreOrganizationBackup("{}", 17, 3, "تأكيد خاطئ")).rejects.toThrow("عبارة تأكيد الاستعادة غير صحيحة");
  });

  it("ينتج اسماً محلياً آمناً مع المحافظة على اسم المؤسسة العربي", () => {
    expect(getOrganizationBackupFilename("رصين للتجارة", "2026-08-25T12:00:00.000Z")).toBe("raseen-backup-رصين-للتجارة-2026-08-25.json");
  });
});
