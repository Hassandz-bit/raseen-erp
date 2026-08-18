const supportedLogoTypes = {
  "image/png": { extension: "png", signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { extension: "jpg", signature: (bytes: Buffer) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  "image/webp": { extension: "webp", signature: (bytes: Buffer) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;

export type OrganizationLogo = { bytes: Buffer; mimeType: keyof typeof supportedLogoTypes; extension: "png" | "jpg" | "webp" };

export function parseOrganizationLogoDataUrl(dataUrl: string): OrganizationLogo {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("نوع الشعار غير مدعوم. استخدم PNG أو JPG أو WEBP.");
  const mimeType = match[1] as OrganizationLogo["mimeType"];
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 1024 * 1024) throw new Error("يجب ألا يتجاوز حجم الشعار 1 ميغابايت.");
  const format = supportedLogoTypes[mimeType];
  if (!format.signature(bytes)) throw new Error("محتوى ملف الشعار لا يطابق نوع الصورة المعلن.");
  return { bytes, mimeType, extension: format.extension };
}

export function isTrustedOrganizationLogoUrl(value: string) {
  return value.startsWith("/manus-storage/");
}
