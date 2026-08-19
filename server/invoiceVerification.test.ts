import { describe, expect, it } from "vitest";
import { signInvoiceVerification, verifyInvoiceVerification } from "./invoiceVerification";

const secret = "invoice-verification-test-secret";
const payload = { v: 1 as const, organizationId: 21, invoiceId: 305, invoiceNumber: "INV-2026-0305", issuedAt: 1_780_000_000_000 };

describe("invoice verification signature", () => {
  it("signs and verifies the exact invoice and organization payload", () => {
    const token = signInvoiceVerification(payload, secret);
    expect(verifyInvoiceVerification(token, secret)).toEqual(payload);
  });

  it("rejects a token whose invoice payload was altered", () => {
    const token = signInvoiceVerification(payload, secret);
    const [body, signature] = token.split(".");
    const alteredBody = Buffer.from(JSON.stringify({ ...payload, invoiceId: 306 })).toString("base64url");
    expect(verifyInvoiceVerification(`${alteredBody}.${signature}`, secret)).toBeNull();
    expect(verifyInvoiceVerification(`${body}.${signature}x`, secret)).toBeNull();
  });

  it("does not validate malformed payloads or an unavailable secret", () => {
    const malformed = Buffer.from(JSON.stringify({ v: 1, invoiceId: 305 })).toString("base64url");
    expect(verifyInvoiceVerification(`${malformed}.signature`, secret)).toBeNull();
    expect(verifyInvoiceVerification(signInvoiceVerification(payload, secret), "")).toBeNull();
    expect(() => signInvoiceVerification(payload, "")).toThrow("مفتاح توقيع");
  });
});
