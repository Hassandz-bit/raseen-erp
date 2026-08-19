import { createHmac, timingSafeEqual } from "crypto";

export type InvoiceVerificationPayload = { v: 1; organizationId: number; invoiceId: number; invoiceNumber: string; issuedAt: number };

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

export function signInvoiceVerification(payload: InvoiceVerificationPayload, secret: string) {
  if (!secret) throw new Error("مفتاح توقيع تحقق الفاتورة غير متاح.");
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyInvoiceVerification(token: string, secret: string): InvoiceVerificationPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra || !secret) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const parsed = JSON.parse(decode(body)) as InvoiceVerificationPayload;
    return parsed.v === 1 && Number.isInteger(parsed.organizationId) && Number.isInteger(parsed.invoiceId) && typeof parsed.invoiceNumber === "string" && typeof parsed.issuedAt === "number" ? parsed : null;
  } catch { return null; }
}
