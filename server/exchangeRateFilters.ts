export type ExchangeRateFilters = { currencyCode?: string; startDate?: Date; endDate?: Date };

export function normalizeExchangeRateFilters(filters: ExchangeRateFilters | undefined): ExchangeRateFilters {
  return {
    currencyCode: filters?.currencyCode?.trim().toUpperCase() || undefined,
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  };
}

export function hasValidExchangeRateDateRange(filters: ExchangeRateFilters) {
  return !(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
}
