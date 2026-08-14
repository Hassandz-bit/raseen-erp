export type OrganizationFormatSettings = {
  currencyCode: "DZD" | "EUR" | "USD" | "SAR";
  currencySymbolPosition: "before" | "after";
  decimalPlaces: number;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
  timeZone: string;
  decimalSeparator: "dot" | "comma";
  thousandsSeparator: "comma" | "dot" | "space";
};

export const currencySymbols: Record<OrganizationFormatSettings["currencyCode"], string> = { DZD: "د.ج", EUR: "€", USD: "$", SAR: "ر.س" };

export function formatOrganizationNumber(value: number, settings: Pick<OrganizationFormatSettings, "decimalPlaces" | "decimalSeparator" | "thousandsSeparator">) {
  const [integer, decimal = ""] = Number(value).toFixed(settings.decimalPlaces).split(".");
  const separator = settings.thousandsSeparator === "space" ? " " : settings.thousandsSeparator === "dot" ? "." : ",";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  if (settings.decimalPlaces === 0) return grouped;
  return `${grouped}${settings.decimalSeparator === "comma" ? "," : "."}${decimal}`;
}

export function formatOrganizationCurrency(value: number, settings: Pick<OrganizationFormatSettings, "currencyCode" | "currencySymbolPosition" | "decimalPlaces" | "decimalSeparator" | "thousandsSeparator">) {
  const amount = formatOrganizationNumber(value, settings);
  const symbol = currencySymbols[settings.currencyCode];
  return settings.currencySymbolPosition === "before" ? `${symbol} ${amount}` : `${amount} ${symbol}`;
}

export function formatOrganizationDate(value: Date | string | number, settings: Pick<OrganizationFormatSettings, "dateFormat" | "timeZone">) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: settings.timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const day = get("day"); const month = get("month"); const year = get("year");
  if (settings.dateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return settings.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

export function formatOrganizationTime(value: Date | string | number, settings: Pick<OrganizationFormatSettings, "timeFormat" | "timeZone">) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: settings.timeZone, hour: "2-digit", minute: "2-digit", hour12: settings.timeFormat === "12h" }).format(new Date(value));
}
