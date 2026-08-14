export function normalizeBarcode(value: string) {
  return value.replace(/\D/g, "").trim();
}

export function isValidBarcode(value: string) {
  return /^\d{8,14}$/.test(normalizeBarcode(value));
}
