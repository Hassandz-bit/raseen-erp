export function normalizeTextBarcode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function isValidTextBarcode(value: string) {
  return /^[A-Za-z0-9\u0621-\u064A\u0660-\u0669\u06F0-\u06F9][A-Za-z0-9\u0621-\u064A\u0660-\u0669\u06F0-\u06F9._/-]{1,95}$/.test(normalizeTextBarcode(value));
}
