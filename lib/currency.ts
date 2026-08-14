export const supportedCurrencies = ["CLP", "MXN", "USD", "EUR"] as const;
export type Currency = (typeof supportedCurrencies)[number];

const locales: Record<Currency, string> = {
  CLP: "es-CL",
  MXN: "es-MX",
  USD: "en-US",
  EUR: "es-ES",
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && supportedCurrencies.includes(value as Currency);
}

export function formatCurrency(value = 0, currency: Currency = "CLP") {
  return new Intl.NumberFormat(locales[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
  }).format(value);
}
