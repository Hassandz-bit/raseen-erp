export type CurrencyCatalogEntry = {
  code: string;
  symbol: string;
  decimalPlaces: number;
  names: { ar: string; fr: string; en: string };
};

const rawCurrencyCatalog: Array<[string, string, number, string, string, string]> = [
  ["DZD", "د.ج", 2, "الدينار الجزائري", "Dinar algérien", "Algerian Dinar"],
  ["SAR", "ر.س", 2, "الريال السعودي", "Riyal saoudien", "Saudi Riyal"],
  ["AED", "د.إ", 2, "الدرهم الإماراتي", "Dirham des Émirats arabes unis", "UAE Dirham"],
  ["QAR", "ر.ق", 2, "الريال القطري", "Riyal qatari", "Qatari Riyal"],
  ["KWD", "د.ك", 3, "الدينار الكويتي", "Dinar koweïtien", "Kuwaiti Dinar"],
  ["BHD", "د.ب", 3, "الدينار البحريني", "Dinar bahreïni", "Bahraini Dinar"],
  ["OMR", "ر.ع.", 3, "الريال العماني", "Rial omanais", "Omani Rial"],
  ["JOD", "د.أ", 3, "الدينار الأردني", "Dinar jordanien", "Jordanian Dinar"],
  ["IQD", "د.ع", 3, "الدينار العراقي", "Dinar irakien", "Iraqi Dinar"],
  ["EGP", "ج.م", 2, "الجنيه المصري", "Livre égyptienne", "Egyptian Pound"],
  ["MAD", "د.م.", 2, "الدرهم المغربي", "Dirham marocain", "Moroccan Dirham"],
  ["TND", "د.ت", 3, "الدينار التونسي", "Dinar tunisien", "Tunisian Dinar"],
  ["LYD", "د.ل", 3, "الدينار الليبي", "Dinar libyen", "Libyan Dinar"],
  ["MRU", "UM", 2, "الأوقية الموريتانية", "Ouguiya mauritanienne", "Mauritanian Ouguiya"],
  ["LBP", "ل.ل", 2, "الليرة اللبنانية", "Livre libanaise", "Lebanese Pound"],
  ["SYP", "ل.س", 2, "الليرة السورية", "Livre syrienne", "Syrian Pound"],
  ["SDG", "ج.س", 2, "الجنيه السوداني", "Livre soudanaise", "Sudanese Pound"],
  ["YER", "ر.ي", 2, "الريال اليمني", "Rial yéménite", "Yemeni Rial"],
  ["SOS", "Sh", 2, "الشلن الصومالي", "Shilling somalien", "Somali Shilling"],
  ["DJF", "Fdj", 0, "الفرنك الجيبوتي", "Franc djiboutien", "Djiboutian Franc"],
  ["KMF", "CF", 0, "الفرنك القمري", "Franc comorien", "Comorian Franc"],
  ["EUR", "€", 2, "اليورو", "Euro", "Euro"],
  ["USD", "$", 2, "الدولار الأمريكي", "Dollar des États-Unis", "US Dollar"],
];

export const currencyCatalog: CurrencyCatalogEntry[] = rawCurrencyCatalog.map(([code, symbol, decimalPlaces, ar, fr, en]) => ({ code, symbol, decimalPlaces, names: { ar, fr, en } }));

export function getCurrencyCatalogEntry(code: string) {
  return currencyCatalog.find(currency => currency.code === code);
}
