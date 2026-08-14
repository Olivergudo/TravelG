"use client";

import { supabase } from "@/lib/supabase";
import { isValidBarcode, normalizeBarcode } from "./barcode";
import { cacheProduct, getLocalProduct } from "./local-cache";
import type { CachedProduct, ProductLookup } from "./types";

const inFlight = new Map<string, Promise<ProductLookup>>();

async function authorization() {
  const { data } = await supabase!.auth.getSession();
  const headers: Record<string, string> = {};
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export async function lookupProduct(value: string): Promise<ProductLookup> {
  const barcode = normalizeBarcode(value);
  if (!isValidBarcode(barcode)) throw new Error("El código debe tener entre 8 y 14 dígitos.");
  const local = getLocalProduct(barcode);
  if (local) return { found: true, product: local, cache: "local" };
  const pending = inFlight.get(barcode);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(`/api/products/barcode/${barcode}`, { headers: await authorization() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "No pudimos identificar el producto.");
    if (!body.found) return { found: false, barcode } as ProductLookup;
    cacheProduct(body.product);
    return body as ProductLookup;
  })().finally(() => inFlight.delete(barcode));
  inFlight.set(barcode, request);
  return request;
}

export async function saveUnknownProduct(product: CachedProduct) {
  const response = await fetch(`/api/products/barcode/${product.barcode}`, { method: "POST", headers: { "Content-Type": "application/json", ...await authorization() }, body: JSON.stringify(product) });
  if (!response.ok) throw new Error("No pudimos guardar este código.");
  cacheProduct(product);
}
