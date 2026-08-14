export type OrganizationFormatSettings = {
  currencyCode: string;
  currencySymbolPosition: "before" | "after";
  decimalPlaces: number;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
  timeZone: string;
  decimalSeparator: "dot" | "comma";
  thousandsSeparator: "comma" | "dot" | "space";
  numeralStyle?: "western" | "arabic_indic";
};

export const currencySymbols: Record<string, string> = { DZD: "د.ج", EUR: "€", USD: "$", SAR: "ر.س", AED: "د.إ", QAR: "ر.ق", KWD: "د.ك", BHD: "د.ب", OMR: "ر.ع.", JOD: "د.أ", EGP: "ج.م", MAD: "د.م.", TND: "د.ت" };
const arabicIndicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
export function applyNumeralStyle(value: string, numeralStyle: "western" | "arabic_indic" = "western") { return numeralStyle === "arabic_indic" ? value.replace(/\d/g, digit => arabicIndicDigits[Number(digit)] ?? digit).replace(/,/g, "٬").replace(/\./g, "٫") : value; }

export function formatOrganizationNumber(value: number, settings: Pick<OrganizationFormatSettings, "decimalPlaces" | "decimalSeparator" | "thousandsSeparator" | "numeralStyle">) {
  const [integer, decimal = ""] = Number(value).toFixed(settings.decimalPlaces).split(".");
  const separator = settings.thousandsSeparator === "space" ? " " : settings.thousandsSeparator === "dot" ? "." : ",";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  const formatted = settings.decimalPlaces === 0 ? grouped : `${grouped}${settings.decimalSeparator === "comma" ? "," : "."}${decimal}`;
  return applyNumeralStyle(formatted, settings.numeralStyle);
}

export function formatOrganizationCurrency(value: number, settings: Pick<OrganizationFormatSettings, "currencyCode" | "currencySymbolPosition" | "decimalPlaces" | "decimalSeparator" | "thousandsSeparator">) {
  const amount = formatOrganizationNumber(value, settings);
  const symbol = currencySymbols[settings.currencyCode] ?? settings.currencyCode;
  return settings.currencySymbolPosition === "before" ? `${symbol} ${amount}` : `${amount} ${symbol}`;
}

export function formatOrganizationDate(value: Date | string | number, settings: Omit<Pick<OrganizationFormatSettings, "dateFormat" | "timeZone" | "numeralStyle">, "dateFormat"> & { dateFormat: string }) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: settings.timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const day = get("day"); const month = get("month"); const year = get("year");
  const formatted = settings.dateFormat === "YYYY-MM-DD" ? `${year}-${month}-${day}` : settings.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  return applyNumeralStyle(formatted, settings.numeralStyle);
}

export function formatOrganizationTime(value: Date | string | number, settings: Pick<OrganizationFormatSettings, "timeFormat" | "timeZone" | "numeralStyle">) {
  return applyNumeralStyle(new Intl.DateTimeFormat("en-GB", { timeZone: settings.timeZone, hour: "2-digit", minute: "2-digit", hour12: settings.timeFormat === "12h" }).format(new Date(value)), settings.numeralStyle);
}
