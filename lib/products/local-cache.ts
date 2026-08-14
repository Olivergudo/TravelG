"use client";

import type { CachedProduct } from "./types";

const KEY = "gasto-listo-product-cache-v1";
const MAX_ENTRIES = 100;

function read(): Record<string, CachedProduct> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function getLocalProduct(barcode: string) {
  return read()[barcode];
}

export function cacheProduct(product: CachedProduct) {
  const cache = read();
  cache[product.barcode] = { ...product, source: "local", updatedAt: new Date().toISOString() };
  const entries = Object.entries(cache).sort((a, b) => (b[1].updatedAt || "").localeCompare(a[1].updatedAt || "")).slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
}
