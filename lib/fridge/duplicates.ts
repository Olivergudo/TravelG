import type { FridgeItem } from "./types";

export type DuplicateMatch = { kind: "exact"; product: FridgeItem };

export function normalizeProductName(value: string) {
  return value.trim().toLocaleLowerCase("es-CL").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function findPossibleDuplicateProduct(
  name: string,
  existingProducts: FridgeItem[],
): DuplicateMatch | undefined {
  const normalized = normalizeProductName(name);
  if (!normalized) return undefined;
  const product = existingProducts.find((item) => normalizeProductName(item.name) === normalized);
  return product ? { kind: "exact", product } : undefined;
}
