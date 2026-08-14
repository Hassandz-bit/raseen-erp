import { describe, expect, it } from "vitest";
import { hasValidExchangeRateDateRange, normalizeExchangeRateFilters } from "./exchangeRateFilters";

describe("exchange rate filters", () => {
  it("normalizes a currency filter without changing the date scope", () => {
    const startDate = new Date("2026-01-01T00:00:00.000Z");
    const endDate = new Date("2026-01-31T23:59:59.999Z");
    expect(normalizeExchangeRateFilters({ currencyCode: " eur ", startDate, endDate })).toEqual({ currencyCode: "EUR", startDate, endDate });
  });

  it("rejects an inverted date interval and accepts an open interval", () => {
    expect(hasValidExchangeRateDateRange({ startDate: new Date("2026-02-01"), endDate: new Date("2026-01-01") })).toBe(false);
    expect(hasValidExchangeRateDateRange({ currencyCode: "DZD", startDate: new Date("2026-01-01") })).toBe(true);
  });
});
