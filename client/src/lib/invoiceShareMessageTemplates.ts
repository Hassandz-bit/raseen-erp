export type AppLanguage = "ar" | "fr" | "en";
export type ShareTemplateSet = { whatsapp?: Partial<Record<AppLanguage, string>>; emailSubject?: Partial<Record<AppLanguage, string>>; emailBody?: Partial<Record<AppLanguage, string>> };
type ShareTemplateChannel = keyof ShareTemplateSet;

export type InvoiceShareTemplateValues = { organization_name: string; customer_name: string; invoice_number: string; invoice_total: string; verification_url: string };

export const invoiceShareTemplateTokens = ["organization_name", "customer_name", "invoice_number", "invoice_total", "verification_url"] as const;

const defaults: Record<AppLanguage, Record<ShareTemplateChannel, string>> = {
  ar: { whatsapp: "مرحباً {{customer_name}}، نشارك معكم فاتورة {{invoice_number}} من {{organization_name}}. الإجمالي: {{invoice_total}}. رابط التحقق: {{verification_url}}", emailSubject: "فاتورة {{invoice_number}} — {{organization_name}}", emailBody: "مرحباً {{customer_name}}،\n\nنشارك معكم فاتورة {{invoice_number}} من {{organization_name}}.\nالإجمالي: {{invoice_total}}.\nرابط التحقق: {{verification_url}}\n\nيرجى إرفاق ملف PDF الذي تم تنزيله قبل الإرسال." },
  fr: { whatsapp: "Bonjour {{customer_name}}, voici votre facture {{invoice_number}} de {{organization_name}}. Total : {{invoice_total}}. Lien de vérification : {{verification_url}}", emailSubject: "Facture {{invoice_number}} — {{organization_name}}", emailBody: "Bonjour {{customer_name}},\n\nVoici votre facture {{invoice_number}} de {{organization_name}}.\nTotal : {{invoice_total}}.\nLien de vérification : {{verification_url}}\n\nVeuillez joindre le PDF téléchargé avant l’envoi." },
  en: { whatsapp: "Hello {{customer_name}}, here is your invoice {{invoice_number}} from {{organization_name}}. Total: {{invoice_total}}. Verification link: {{verification_url}}", emailSubject: "Invoice {{invoice_number}} — {{organization_name}}", emailBody: "Hello {{customer_name}},\n\nHere is your invoice {{invoice_number}} from {{organization_name}}.\nTotal: {{invoice_total}}.\nVerification link: {{verification_url}}\n\nPlease attach the downloaded PDF before sending." },
};

export function getInvoiceShareTemplate(templates: ShareTemplateSet | undefined, channel: ShareTemplateChannel, language: AppLanguage): string {
  return templates?.[channel]?.[language]?.trim() || defaults[language][channel];
}

export function renderInvoiceShareTemplate(template: string, values: InvoiceShareTemplateValues) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (token, key: keyof InvoiceShareTemplateValues) => key in values ? values[key] : token).replace(/\s+\n/g, "\n").trim();
}
