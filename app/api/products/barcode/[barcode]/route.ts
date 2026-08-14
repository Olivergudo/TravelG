import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedSupabase, serviceSupabase } from "@/lib/server/authenticated-supabase";
import { isValidBarcode, normalizeBarcode } from "@/lib/products/barcode";

const productSchema = z.object({ barcode: z.string(), name: z.string().trim().min(1).max(160), brand: z.string().max(120).optional(), quantityText: z.string().max(80).optional(), category: z.string().max(160).optional() });
const columns = "barcode,name,brand,quantity_text,category,source,updated_at";
const format = (row: Record<string, unknown>, source?: string) => ({ barcode: String(row.barcode), name: String(row.name), brand: row.brand || undefined, quantityText: row.quantity_text || undefined, category: row.category || undefined, source: source || row.source, updatedAt: row.updated_at });

export async function GET(request: Request, context: { params: Promise<{ barcode: string }> }) {
  const auth = await authenticatedSupabase(request);
  if (!auth) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (!auth.pro) return NextResponse.json({ message: "Esta función requiere Pro." }, { status: 403 });
  const barcode = normalizeBarcode((await context.params).barcode);
  if (!isValidBarcode(barcode)) return NextResponse.json({ message: "Código inválido." }, { status: 400 });

  const { data: cached } = await auth.client.from("products_cache").select(columns).eq("barcode", barcode).limit(1).maybeSingle();
  if (cached) {
    console.info("[barcode] cache_supabase hit", { barcode });
    return NextResponse.json({ found: true, product: format(cached), cache: "supabase" });
  }
  console.info("[barcode] cache_supabase miss", { barcode });

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,quantity,categories`;
    const response = await fetch(url, { headers: { "User-Agent": "GastoListo/1.0 (https://travel-g-phi.vercel.app)" }, signal: AbortSignal.timeout(8000) });
    const body = await response.json();
    const productName = body?.product?.product_name?.trim();
    if (!response.ok || body.status !== 1 || !productName) {
      console.info("[barcode] open_food_facts miss", { barcode });
      return NextResponse.json({ found: false, barcode });
    }
    const row = { barcode, name: productName, brand: body.product.brands?.trim() || null, quantity_text: body.product.quantity?.trim() || null, category: body.product.categories?.split(",")[0]?.trim() || null, source: "open_food_facts", updated_at: new Date().toISOString() };
    const admin = serviceSupabase();
    if (admin) await admin.from("products_cache").upsert(row, { onConflict: "barcode" });
    console.info("[barcode] open_food_facts hit", { barcode });
    return NextResponse.json({ found: true, product: format(row, "open_food_facts"), cache: "open_food_facts" });
  } catch (error) {
    console.error("[barcode] open_food_facts error", { barcode, message: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ message: "Necesitamos conexión para identificar este producto." }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ barcode: string }> }) {
  const auth = await authenticatedSupabase(request);
  if (!auth) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (!auth.pro) return NextResponse.json({ message: "Esta función requiere Pro." }, { status: 403 });
  const barcode = normalizeBarcode((await context.params).barcode);
  const parsed = productSchema.safeParse({ ...await request.json(), barcode });
  if (!parsed.success || !isValidBarcode(barcode)) return NextResponse.json({ message: "Producto inválido." }, { status: 400 });
  const admin = serviceSupabase();
  if (!admin) return NextResponse.json({ message: "Falta configurar SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  const value = parsed.data;
  await admin.from("products_cache").upsert({ barcode, name: value.name, brand: value.brand || null, quantity_text: value.quantityText || null, category: value.category || null, source: "user", updated_at: new Date().toISOString() }, { onConflict: "barcode" });
  return NextResponse.json({ saved: true });
}
